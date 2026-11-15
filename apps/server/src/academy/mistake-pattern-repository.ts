// The Learner's Mistake Patterns. Ported from Grifando
// src/server/domain/mistakes/mistakePattern.repository.ts (74dbb9f): a repeated occurrence of one
// concept grows one pattern instead of adding a row (Grifando SPEC.md §6), and each occurrence in
// writing is a failed recall for the half-life model.
import { randomUUID } from "node:crypto";

import type { MasteryLevel, MistakeCategory } from "@fluenshift/contract";
import { normalizePatternKey } from "@fluenshift/core/pattern-key";
import { Database, learners, mistakePatterns } from "@fluenshift/db";
import { desc, eq, sql } from "drizzle-orm";
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

const toPattern = (
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

export const upsertPattern = Effect.fn(
  "MistakePatternRepository.upsertPattern"
)(function* (input: UpsertPatternInput) {
  const database = yield* Database;
  const learner = yield* CurrentLearner;
  const patternKey = normalizePatternKey(input.rawPatternKey);
  const now = new Date();
  const rows = yield* database.run((client) =>
    client.transaction((transaction) =>
      transaction
        .insert(learners)
        .values({ id: learner.id })
        .onConflictDoNothing()
        .then(() =>
          transaction
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
              learnerId: learner.id,
              occurrenceCount: 1,
              patternKey,
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
        )
    )
  );
  const [row] = rows;
  if (row === undefined) {
    return yield* Effect.die(new Error("The upsert returned no pattern"));
  }
  return toPattern(row);
});

// The Learner's patterns, most frequent first, then most recent.
export const listPatterns = Effect.fn("MistakePatternRepository.listPatterns")(
  function* () {
    const database = yield* Database;
    const learner = yield* CurrentLearner;
    const rows = yield* database.run((client) =>
      client
        .select()
        .from(mistakePatterns)
        .where(eq(mistakePatterns.learnerId, learner.id))
        .orderBy(
          desc(mistakePatterns.occurrenceCount),
          desc(mistakePatterns.lastSeenAt)
        )
    );
    return rows.map(toPattern);
  }
);
