// The Learner's Occurrences, counted and listed. Ported from Grifando
// src/server/domain/mistakes/mistakeOccurrence.repository.ts (74dbb9f): countByCategory and
// listByAnalysis.
import type {
  MistakeCategory,
  MistakeSeverity,
  PracticeOccurrence,
} from "@grifando/contract";
import type { CategoryCount } from "@grifando/core/analytics";
import { Database, occurrences } from "@grifando/db";
import { and, asc, count, eq, gte } from "drizzle-orm";
import { Effect } from "effect";

import { CurrentLearner } from "../learner-identity";

export interface CountOccurrencesOptions {
  // Only the Occurrences recorded at or after this moment.
  readonly since?: Date;
}

// The Learner's Occurrences per Mistake Category, in no particular order.
export const countOccurrencesByCategory = Effect.fn(
  "OccurrenceRepository.countOccurrencesByCategory"
)(function* (options: CountOccurrencesOptions = {}) {
  const database = yield* Database;
  const learner = yield* CurrentLearner;
  const rows = yield* database.run((client) =>
    client
      .select({ category: occurrences.category, count: count() })
      .from(occurrences)
      .where(
        and(
          eq(occurrences.learnerId, learner.id),
          options.since === undefined
            ? undefined
            : gte(occurrences.createdAt, options.since)
        )
      )
      .groupBy(occurrences.category)
  );
  return rows.map((row): CategoryCount => ({
    category: row.category as MistakeCategory,
    count: row.count,
  }));
});

// The Learner's Occurrences from one Evaluation, in the order of its Findings; Naturalness Notes,
// which have no Finding, come last, in the Trainer's order (Grifando's listByAnalysis,
// docs/adr/0028).
export const listOccurrencesForEvaluation = Effect.fn(
  "OccurrenceRepository.listOccurrencesForEvaluation"
)(function* (evaluationId: string) {
  const database = yield* Database;
  const learner = yield* CurrentLearner;
  const rows = yield* database.run((client) =>
    client
      .select()
      .from(occurrences)
      .where(
        and(
          eq(occurrences.learnerId, learner.id),
          eq(occurrences.evaluationId, evaluationId)
        )
      )
      .orderBy(asc(occurrences.findingPosition), asc(occurrences.notePosition))
  );
  return rows.map((row): PracticeOccurrence => ({
    category: row.category as MistakeCategory,
    correctedSpan: row.correctedSpan,
    example: row.example,
    explanation: row.explanation,
    findingPosition: row.findingPosition,
    id: row.id,
    l1Transfer: row.l1Transfer,
    originalSpan: row.originalSpan,
    severity: row.severity as MistakeSeverity,
  }));
});
