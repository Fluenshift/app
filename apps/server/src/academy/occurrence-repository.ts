// The Learner's Occurrences, counted. Ported from Grifando
// src/server/domain/mistakes/mistakeOccurrence.repository.ts (74dbb9f), countByCategory.
import type { MistakeCategory } from "@fluenshift/contract";
import type { CategoryCount } from "@fluenshift/core/analytics";
import { Database, occurrences } from "@fluenshift/db";
import { and, count, eq, gte } from "drizzle-orm";
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
