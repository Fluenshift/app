// Ported from ensureUser in Grifando src/server/session/currentUser.ts (74dbb9f): the Learner's
// row exists after any write, and its last activity, which the hosted profile's idle cleanup
// reads (docs/adr/0011), moves at most once an hour.
import { Database, learners } from "@grifando/db";
import { and, eq, lt } from "drizzle-orm";
import { Effect } from "effect";

import { CurrentLearner } from "../learner-identity";

const ACTIVITY_BUMP_MILLISECONDS = 60 * 60 * 1000;

/** Creates the current Learner's row if it is missing, and records the Learner's activity. */
export const ensureLearner = Effect.fn("LearnerActivity.ensureLearner")(
  function* () {
    const database = yield* Database;
    const learner = yield* CurrentLearner;
    yield* database.run((client) =>
      client
        .insert(learners)
        .values({ id: learner.id })
        .onConflictDoNothing()
        .then(() =>
          client
            .update(learners)
            .set({ lastActiveAt: new Date() })
            .where(
              and(
                eq(learners.id, learner.id),
                lt(
                  learners.lastActiveAt,
                  new Date(Date.now() - ACTIVITY_BUMP_MILLISECONDS)
                )
              )
            )
        )
    );
  }
);
