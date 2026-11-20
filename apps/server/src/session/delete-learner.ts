// Ported from deleteUserData in Grifando src/server/domain/privacy/cleanup.ts (74dbb9f): deleting
// the Learner's row deletes every row that belongs to the Learner, since each table's reference
// to the Learner, direct or through an Evaluation, cascades (packages/db/src/schema.ts).
import { Database } from "@fluenshift/db";
import { Effect } from "effect";

import { CurrentLearner } from "../learner-identity";

// Stub: reads what it needs and deletes nothing.
export const deleteLearner = Effect.fn("LearnerDeletion.deleteLearner")(
  function* () {
    yield* Database;
    yield* CurrentLearner;
  }
);
