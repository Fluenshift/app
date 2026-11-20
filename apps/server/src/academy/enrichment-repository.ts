// The Learner's Enrichment records: what the Trainer added to an Evaluation beside its
// Occurrences (docs/adr/0028).
import { Database, enrichments } from "@fluenshift/db";
import { and, eq } from "drizzle-orm";
import { Effect } from "effect";

import { CurrentLearner } from "../learner-identity";

// The natural version of an Evaluation's Writing Sample, or null when the Learner has no
// Enrichment of that Evaluation, or one recorded before it had a natural version.
export const getNaturalVersion = Effect.fn(
  "EnrichmentRepository.getNaturalVersion"
)(function* (evaluationId: string) {
  const database = yield* Database;
  const learner = yield* CurrentLearner;
  const rows = yield* database.run((client) =>
    client
      .select({ naturalVersion: enrichments.naturalVersion })
      .from(enrichments)
      .where(
        and(
          eq(enrichments.learnerId, learner.id),
          eq(enrichments.evaluationId, evaluationId)
        )
      )
  );
  return rows[0]?.naturalVersion ?? null;
});
