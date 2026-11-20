// Folds an Evaluation's Findings into the Learner's Mistake Patterns. Ported from Grifando
// src/server/domain/writing/writingCoachService.ts (74dbb9f) under docs/adr/0004: the Judge has
// already evaluated and stored the Writing Sample, so the Academy only reads its Findings, asks
// the Trainer's Enrichment for the Academy fields, the natural version and the Naturalness Notes,
// and records one Occurrence per Finding, then one per note (docs/adr/0028).
import { randomUUID } from "node:crypto";

import { MistakeCategory, mistakeCategoriesOf } from "@fluenshift/contract";
import type { LearnerId, MistakeSeverity } from "@fluenshift/contract";
import { applyExerciseResult } from "@fluenshift/core/mastery";
import {
  Database,
  enrichments,
  mistakePatterns,
  occurrences,
} from "@fluenshift/db";
import type { DrizzleClient } from "@fluenshift/db";
import { and, eq } from "drizzle-orm";
import { Effect } from "effect";

import { getEvaluation } from "../history/learning-history";
import type {
  Evaluation,
  EvaluationFinding,
} from "../history/learning-history";
import { CurrentLearner } from "../learner-identity";
import { toPattern, upsertPatternRow } from "./mistake-pattern-repository";
import type {
  Enrichment,
  FindingEnrichment,
  NaturalnessNote,
  TrainerMethods,
} from "./trainer/trainer-model";

// One Finding, or one Naturalness Note, as the Academy records it under a Mistake Pattern.
export interface Occurrence {
  readonly category: MistakeCategory;
  readonly correctedSpan: string;
  readonly createdAt: Date;
  readonly evaluationId: string;
  readonly example: string;
  readonly explanation: string;
  readonly findingPosition: number | null;
  readonly id: string;
  readonly l1Transfer: boolean;
  readonly notePosition: number | null;
  readonly originalSpan: string;
  readonly patternId: string;
  readonly rubricVersion: string;
  readonly severity: MistakeSeverity;
}

export interface FoldEvaluationInput {
  // Explain Code only: context for the Trainer, never stored (Grifando SPEC.md §5.6).
  readonly codeSnippet?: string;
  readonly evaluationId: string;
}

export interface FoldedEvaluation {
  readonly naturalVersion: string | null;
  readonly occurrences: readonly Occurrence[];
}

// A Finding with its position in its Evaluation.
interface PlacedFinding {
  readonly finding: EvaluationFinding;
  readonly position: number;
}

// A Naturalness Note with its place among the Enrichment's notes.
interface PlacedNote {
  readonly note: NaturalnessNote;
  readonly position: number;
}

const toOccurrence = (row: typeof occurrences.$inferSelect): Occurrence => ({
  category: row.category as MistakeCategory,
  correctedSpan: row.correctedSpan,
  createdAt: row.createdAt,
  evaluationId: row.evaluationId,
  example: row.example,
  explanation: row.explanation,
  findingPosition: row.findingPosition,
  id: row.id,
  l1Transfer: row.l1Transfer,
  notePosition: row.notePosition,
  originalSpan: row.originalSpan,
  patternId: row.patternId,
  rubricVersion: row.rubricVersion,
  severity: row.severity as MistakeSeverity,
});

// One Finding folded into its pattern, then recorded as an Occurrence of it.
const foldFinding = (
  client: DrizzleClient,
  learnerId: LearnerId,
  evaluation: Evaluation,
  { finding, position }: PlacedFinding,
  enrichment: FindingEnrichment,
  now: Date
) =>
  upsertPatternRow(
    client,
    learnerId,
    {
      category: enrichment.category,
      exampleCorrection: finding.correction,
      exampleOriginal: finding.originalText,
      rawPatternKey: enrichment.patternKey,
    },
    now,
    true
  )
    .then((row) => {
      if (row === undefined) {
        throw new Error("The upsert returned no pattern");
      }
      const pattern = toPattern(row);
      // Making the mistake again is a failed recall: it costs mastery the same way an incorrect
      // exercise attempt does (Grifando SPEC.md §6), whatever the Writing Sample's origin
      // (docs/adr/0014).
      const demoted = applyExerciseResult(pattern, false);
      const changed =
        demoted.masteryLevel !== pattern.masteryLevel ||
        demoted.consecutiveCorrectCount !== pattern.consecutiveCorrectCount;
      const demotion = changed
        ? client
            .update(mistakePatterns)
            .set(demoted)
            .where(
              and(
                eq(mistakePatterns.learnerId, learnerId),
                eq(mistakePatterns.id, pattern.id)
              )
            )
            .then(() => pattern.id)
        : Promise.resolve(pattern.id);
      return demotion;
    })
    .then((patternId) =>
      client
        .insert(occurrences)
        .values({
          category: enrichment.category,
          correctedSpan: finding.correction,
          evaluationId: evaluation.id,
          example: enrichment.example,
          explanation: finding.explanation,
          findingPosition: position,
          id: randomUUID(),
          l1Transfer: enrichment.l1Transfer,
          learnerId,
          originalSpan: finding.originalText,
          patternId,
          rubricVersion: evaluation.rubricVersion,
          severity: "ERROR",
        })
        .returning()
    );

// One Naturalness Note folded into its unnatural-phrasing pattern, then recorded as an Occurrence
// of it, at its place among the notes. A note grows the pattern but is never a failed recall: no
// incorrect count and no demotion (docs/adr/0020, docs/adr/0028).
const foldNote = (
  client: DrizzleClient,
  learnerId: LearnerId,
  evaluation: Evaluation,
  { note, position }: PlacedNote,
  now: Date
) =>
  upsertPatternRow(
    client,
    learnerId,
    {
      category: MistakeCategory.UNNATURAL_PHRASING,
      exampleCorrection: note.naturalSpan,
      exampleOriginal: note.originalSpan,
      rawPatternKey: note.patternKey,
    },
    now,
    false
  ).then((row) => {
    if (row === undefined) {
      throw new Error("The upsert returned no pattern");
    }
    return client
      .insert(occurrences)
      .values({
        category: MistakeCategory.UNNATURAL_PHRASING,
        correctedSpan: note.naturalSpan,
        evaluationId: evaluation.id,
        example: note.example,
        explanation: note.explanation,
        id: randomUUID(),
        l1Transfer: note.l1Transfer,
        learnerId,
        notePosition: position,
        originalSpan: note.originalSpan,
        patternId: row.id,
        rubricVersion: evaluation.rubricVersion,
        severity: "UNNATURAL",
      })
      .returning();
  });

type OccurrenceRow = typeof occurrences.$inferSelect;

// Folds the notes one after the other, in the Trainer's order.
const foldNotesInOrder = (
  client: DrizzleClient,
  learnerId: LearnerId,
  evaluation: Evaluation,
  remaining: readonly PlacedNote[],
  now: Date,
  recorded: readonly OccurrenceRow[] = []
): Promise<readonly OccurrenceRow[]> => {
  const [next, ...rest] = remaining;
  if (next === undefined) {
    return Promise.resolve(recorded);
  }
  return foldNote(client, learnerId, evaluation, next, now).then((rows) =>
    foldNotesInOrder(client, learnerId, evaluation, rest, now, [
      ...recorded,
      ...rows,
    ])
  );
};

// Folds the Findings one after the other, in position order, as Grifando did.
const foldInOrder = (
  client: DrizzleClient,
  learnerId: LearnerId,
  evaluation: Evaluation,
  remaining: readonly (readonly [PlacedFinding, FindingEnrichment])[],
  now: Date,
  recorded: readonly OccurrenceRow[] = []
): Promise<readonly OccurrenceRow[]> => {
  const [next, ...rest] = remaining;
  if (next === undefined) {
    return Promise.resolve(recorded);
  }
  const [placed, enrichment] = next;
  return foldFinding(
    client,
    learnerId,
    evaluation,
    placed,
    enrichment,
    now
  ).then((rows) =>
    foldInOrder(client, learnerId, evaluation, rest, now, [
      ...recorded,
      ...rows,
    ])
  );
};

// The Enrichment, every folded Finding and every folded note, in one transaction: a failure
// records none of them.
const recordEnrichment = (
  client: DrizzleClient,
  learnerId: LearnerId,
  evaluation: Evaluation,
  pairs: readonly (readonly [PlacedFinding, FindingEnrichment])[],
  enrichment: Enrichment
) =>
  client.transaction((transaction) => {
    const now = new Date();
    return transaction
      .insert(enrichments)
      .values({
        evaluationId: evaluation.id,
        learnerId,
        model: enrichment.model,
        naturalVersion: enrichment.naturalVersion,
      })
      .then(() => foldInOrder(transaction, learnerId, evaluation, pairs, now))
      .then((findingRows) =>
        foldNotesInOrder(
          transaction,
          learnerId,
          evaluation,
          enrichment.naturalnessNotes.map((note, position) => ({
            note,
            position,
          })),
          now,
          findingRows
        )
      );
  });

export const foldEvaluation = Effect.fn("PatternFolding.foldEvaluation")(
  function* (trainer: TrainerMethods, input: FoldEvaluationInput) {
    const evaluation = yield* getEvaluation(input.evaluationId);
    if (evaluation === null) {
      return null;
    }
    // A Mistake Pattern is identified by a Mistake Category, and Clarity and Other have none
    // (docs/adr/0005). Learning History lists the Findings in position order. The Trainer runs
    // even when no Finding is left: the natural version and the notes need none (docs/adr/0028).
    const placed = evaluation.findings.flatMap(
      (finding, position): PlacedFinding[] =>
        mistakeCategoriesOf(finding.category).length > 0
          ? [{ finding, position }]
          : []
    );

    const enrichment = yield* trainer.enrichFindings({
      ...(input.codeSnippet === undefined
        ? {}
        : { codeSnippet: input.codeSnippet }),
      findings: placed.map(({ finding }) => ({
        category: finding.category,
        correction: finding.correction,
        explanation: finding.explanation,
        originalText: finding.originalText,
      })),
      writingSample: evaluation.originalText,
    });

    // A Trainer answers one FindingEnrichment per Finding it was given, in order.
    const pairs = placed.flatMap(
      (
        placedFinding,
        index
      ): (readonly [PlacedFinding, FindingEnrichment])[] => {
        const findingEnrichment = enrichment.findings[index];
        return findingEnrichment === undefined
          ? []
          : [[placedFinding, findingEnrichment]];
      }
    );
    if (pairs.length !== placed.length) {
      return yield* Effect.die(new Error("The Enrichment misses a Finding"));
    }

    const database = yield* Database;
    const learner = yield* CurrentLearner;
    const rows = yield* database.run((client) =>
      recordEnrichment(client, learner.id, evaluation, pairs, enrichment)
    );
    const folded: FoldedEvaluation = {
      naturalVersion: enrichment.naturalVersion,
      occurrences: rows.map(toOccurrence),
    };
    return folded;
  }
);
