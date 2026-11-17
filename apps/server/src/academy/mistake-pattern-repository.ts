// The Learner's Mistake Patterns. Ported from Grifando
// src/server/domain/mistakes/mistakePattern.repository.ts (74dbb9f): a repeated occurrence of one
// concept grows one pattern instead of adding a row (Grifando SPEC.md §6), and each occurrence in
// writing is a failed recall for the half-life model.
import { randomUUID } from "node:crypto";

import type {
  LearnerId,
  MasteryLevel,
  MistakeCategory,
} from "@fluenshift/contract";
import { normalizePatternKey } from "@fluenshift/core/pattern-key";
import {
  Database,
  learners,
  mistakePatterns,
  occurrences,
} from "@fluenshift/db";
import type { DrizzleClient } from "@fluenshift/db";
import { and, desc, eq, exists, sql } from "drizzle-orm";
import { Effect } from "effect";

import { CurrentLearner } from "../learner-identity";

export interface MistakePattern {
  readonly category: MistakeCategory;
  readonly consecutiveCorrectCount: number;
  readonly correctCount: number;
  readonly exampleCorrection: string;
  readonly exampleOriginal: string;
  readonly firstSeenAt: Date;
  readonly id: string;
  readonly incorrectCount: number;
  readonly lastPracticedAt: Date;
  readonly lastSeenAt: Date;
  readonly masteryLevel: MasteryLevel;
  readonly occurrenceCount: number;
  readonly patternKey: string;
}

export interface UpsertPatternInput {
  readonly category: MistakeCategory;
  readonly exampleCorrection: string;
  readonly exampleOriginal: string;
  readonly rawPatternKey: string;
}

export const toPattern = (
  row: typeof mistakePatterns.$inferSelect
): MistakePattern => ({
  category: row.category as MistakeCategory,
  consecutiveCorrectCount: row.consecutiveCorrectCount,
  correctCount: row.correctCount,
  exampleCorrection: row.exampleCorrection,
  exampleOriginal: row.exampleOriginal,
  firstSeenAt: row.firstSeenAt,
  id: row.id,
  incorrectCount: row.incorrectCount,
  lastPracticedAt: row.lastPracticedAt,
  lastSeenAt: row.lastSeenAt,
  masteryLevel: row.masteryLevel as MasteryLevel,
  occurrenceCount: row.occurrenceCount,
  patternKey: row.patternKey,
});

// One more occurrence of a concept for the Learner: a new pattern, or the existing one grown,
// with its examples replaced by the latest. Runs on a client or inside a transaction.
export const upsertPatternRow = (
  client: DrizzleClient,
  learnerId: LearnerId,
  input: UpsertPatternInput,
  now: Date
) =>
  client
    .insert(mistakePatterns)
    .values({
      category: input.category,
      exampleCorrection: input.exampleCorrection,
      exampleOriginal: input.exampleOriginal,
      firstSeenAt: now,
      id: randomUUID(),
      incorrectCount: 1,
      lastPracticedAt: now,
      lastSeenAt: now,
      learnerId,
      occurrenceCount: 1,
      patternKey: normalizePatternKey(input.rawPatternKey),
    })
    .onConflictDoUpdate({
      set: {
        exampleCorrection: input.exampleCorrection,
        exampleOriginal: input.exampleOriginal,
        incorrectCount: sql`${mistakePatterns.incorrectCount} + 1`,
        lastPracticedAt: now,
        lastSeenAt: now,
        occurrenceCount: sql`${mistakePatterns.occurrenceCount} + 1`,
      },
      target: [
        mistakePatterns.learnerId,
        mistakePatterns.category,
        mistakePatterns.patternKey,
      ],
    })
    .returning()
    .then(([row]) => row);

export const upsertPattern = Effect.fn(
  "MistakePatternRepository.upsertPattern"
)(function* (input: UpsertPatternInput) {
  const database = yield* Database;
  const learner = yield* CurrentLearner;
  const now = new Date();
  const row = yield* database.run((client) =>
    client.transaction((transaction) =>
      transaction
        .insert(learners)
        .values({ id: learner.id })
        .onConflictDoNothing()
        .then(() => upsertPatternRow(transaction, learner.id, input, now))
    )
  );
  if (row === undefined) {
    return yield* Effect.die(new Error("The upsert returned no pattern"));
  }
  return toPattern(row);
});

export interface ListPatternsOptions {
  // Only the patterns with at least one Occurrence flagged as L1 Transfer.
  readonly l1TransferOnly?: boolean;
}

// The Learner's patterns, most frequent first, then most recent.
export const listPatterns = Effect.fn("MistakePatternRepository.listPatterns")(
  function* (options: ListPatternsOptions = {}) {
    const database = yield* Database;
    const learner = yield* CurrentLearner;
    const rows = yield* database.run((client) =>
      client
        .select()
        .from(mistakePatterns)
        .where(
          and(
            eq(mistakePatterns.learnerId, learner.id),
            options.l1TransferOnly === true
              ? exists(
                  client
                    .select({ id: occurrences.id })
                    .from(occurrences)
                    .where(
                      and(
                        eq(occurrences.learnerId, mistakePatterns.learnerId),
                        eq(occurrences.patternId, mistakePatterns.id),
                        eq(occurrences.l1Transfer, true)
                      )
                    )
                )
              : undefined
          )
        )
        .orderBy(
          desc(mistakePatterns.occurrenceCount),
          desc(mistakePatterns.lastSeenAt)
        )
    );
    return rows.map(toPattern);
  }
);

// One of the Learner's patterns, or null when the Learner has none with that id.
// The Learner's patterns with an Occurrence from one Evaluation (Grifando's listIdsForSession).
export const listPatternIdsForEvaluation = Effect.fn(
  "MistakePatternRepository.listPatternIdsForEvaluation"
)(function* (evaluationId: string) {
  const database = yield* Database;
  const learner = yield* CurrentLearner;
  const rows = yield* database.run((client) =>
    client
      .selectDistinct({ id: occurrences.patternId })
      .from(occurrences)
      .where(
        and(
          eq(occurrences.learnerId, learner.id),
          eq(occurrences.evaluationId, evaluationId)
        )
      )
  );
  return rows.map((row) => row.id);
});

export const findPattern = Effect.fn("MistakePatternRepository.findPattern")(
  function* (id: string) {
    const database = yield* Database;
    const learner = yield* CurrentLearner;
    const [row] = yield* database.run((client) =>
      client
        .select()
        .from(mistakePatterns)
        .where(
          and(
            eq(mistakePatterns.learnerId, learner.id),
            eq(mistakePatterns.id, id)
          )
        )
    );
    return row === undefined ? null : toPattern(row);
  }
);

export interface RecordAttemptInput {
  readonly consecutiveCorrectCount: number;
  readonly isCorrect: boolean;
  readonly masteryLevel: MasteryLevel;
}

// One Attempt on the pattern: the new mastery state plus a recall event for the half-life
// counters.
export const recordAttempt = Effect.fn(
  "MistakePatternRepository.recordAttempt"
)(function* (id: string, { isCorrect, ...mastery }: RecordAttemptInput) {
  const database = yield* Database;
  const learner = yield* CurrentLearner;
  yield* database.run((client) =>
    client
      .update(mistakePatterns)
      .set({
        ...mastery,
        ...(isCorrect
          ? { correctCount: sql`${mistakePatterns.correctCount} + 1` }
          : { incorrectCount: sql`${mistakePatterns.incorrectCount} + 1` }),
        lastPracticedAt: new Date(),
      })
      .where(
        and(
          eq(mistakePatterns.learnerId, learner.id),
          eq(mistakePatterns.id, id)
        )
      )
  );
});
