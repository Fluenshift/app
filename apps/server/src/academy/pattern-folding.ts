// Folds an Evaluation's Findings into the Learner's Mistake Patterns. Ported from Grifando
// src/server/domain/writing/writingCoachService.ts (74dbb9f) under docs/adr/0004: the Judge has
// already evaluated and stored the Writing Sample, so the Academy only reads its Findings, asks
// the Trainer's Enrichment for the Academy fields, and records one Occurrence per Finding.
import { randomUUID } from "node:crypto";

import { mistakeCategoriesOf } from "@fluenshift/contract";
import type {
  LearnerId,
  MistakeCategory,
  MistakeSeverity,
} from "@fluenshift/contract";
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
  FindingEnrichment,
  TrainerMethods,
} from "./trainer/trainer-model";

// One Finding as the Academy records it under a Mistake Pattern.
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
  readonly occurrences: readonly Occurrence[];
}

// A Finding with its position in its Evaluation.
interface PlacedFinding {
  readonly finding: EvaluationFinding;
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
    now
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

type OccurrenceRow = typeof occurrences.$inferSelect;

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

// The Enrichment and every folded Finding, in one transaction: a failure records none of them.
const recordEnrichment = (
  client: DrizzleClient,
  learnerId: LearnerId,
  evaluation: Evaluation,
  pairs: readonly (readonly [PlacedFinding, FindingEnrichment])[],
  model: string
) =>
  client.transaction((transaction) =>
    transaction
      .insert(enrichments)
      .values({
        evaluationId: evaluation.id,
        learnerId,
        model,
      })
      .then(() =>
        foldInOrder(transaction, learnerId, evaluation, pairs, new Date())
      )
  );

export const foldEvaluation = Effect.fn("PatternFolding.foldEvaluation")(
  function* (trainer: TrainerMethods, input: FoldEvaluationInput) {
    const evaluation = yield* getEvaluation(input.evaluationId);
    if (evaluation === null) {
      return null;
    }
    // A Mistake Pattern is identified by a Mistake Category, and Clarity and Other have none
    // (docs/adr/0005). Learning History lists the Findings in position order.
    const placed = evaluation.findings.flatMap(
      (finding, position): PlacedFinding[] =>
        mistakeCategoriesOf(finding.category).length > 0
          ? [{ finding, position }]
          : []
    );
    if (placed.length === 0) {
      return { occurrences: [] };
    }

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
      recordEnrichment(client, learner.id, evaluation, pairs, enrichment.model)
    );
    return { occurrences: rows.map(toOccurrence) };
  }
);
