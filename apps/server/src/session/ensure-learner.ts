// Ported from ensureUser in Grifando src/server/session/currentUser.ts (74dbb9f): the Learner's
// row exists after any write, and its last activity, which the hosted profile's idle cleanup
// reads (docs/adr/0011), moves at most once an hour.
import { Database } from "@fluenshift/db";
import { Effect } from "effect";

import { CurrentLearner } from "../learner-identity";

// Stub: reads what it needs and writes nothing.
export const ensureLearner = Effect.fn("LearnerActivity.ensureLearner")(
  function* () {
    yield* Database;
    yield* CurrentLearner;
  }
);
