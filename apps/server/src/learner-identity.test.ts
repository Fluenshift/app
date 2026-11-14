import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";

import { LearnerIdentity, LOCAL_LEARNER_ID } from "./learner-identity";

describe("LearnerIdentity", () => {
  it.effect(
    "gives the local profile one implicit Learner, whatever the request",
    () =>
      Effect.gen(function* () {
        const identity = yield* LearnerIdentity;
        const first = yield* identity.identify(
          new Request("http://localhost/api/health")
        );
        const second = yield* identity.identify(
          new Request("http://127.0.0.1/api/evaluations", {
            headers: { cookie: "ig_session=someone-else" },
            method: "POST",
          })
        );

        assert.strictEqual(first, LOCAL_LEARNER_ID);
        assert.strictEqual(second, LOCAL_LEARNER_ID);
        assert.strictEqual(LOCAL_LEARNER_ID, "local");
      }).pipe(Effect.provide(LearnerIdentity.local))
  );
});
