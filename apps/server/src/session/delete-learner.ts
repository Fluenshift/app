// Ported from deleteUserData in Grifando src/server/domain/privacy/cleanup.ts (74dbb9f): deleting
// the Learner's row deletes every row that belongs to the Learner, since each table's reference
// to the Learner, direct or through an Evaluation, cascades (packages/db/src/schema.ts).
import { Database, learners } from "@grifando/db";
import { eq } from "drizzle-orm";
import { Effect } from "effect";

import { CurrentLearner } from "../learner-identity";

/** Deletes the current Learner and, through the cascades, everything stored for them. */
export const deleteLearner = Effect.fn("LearnerDeletion.deleteLearner")(
  function* () {
    const database = yield* Database;
    const learner = yield* CurrentLearner;
    yield* database.run((client) =>
      client.delete(learners).where(eq(learners.id, learner.id))
    );
  }
);
