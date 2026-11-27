// Ported from Grifando src/server/session/getCurrentUserId.test.ts (74dbb9f) as a contract test:
// LearnerIdentity.hosted reads the signed cookie of the request instead of Next.js's cookie
// store, signed with the secret SessionConfig reads, and fails with MissingSessionError where
// getCurrentUserId threw it.
import { SessionConfig } from "@grifando/env";
import { ConfigProvider, Effect, Layer, Redacted } from "effect";
import { describe, expect, it } from "vitest";

import { LearnerIdentity, MissingSessionError } from "./learner-identity";
import { SESSION_COOKIE, signSessionId } from "./session/session-token";

const sessionConfig = SessionConfig.layer.pipe(
  Layer.provide(
    ConfigProvider.layer(
      ConfigProvider.fromEnvRecord({
        SESSION_SECRET: "identity-test-secret-xxxxxxxxxxxxxxxxxxxx",
      })
    )
  )
);

const getSessionSecret = () =>
  Redacted.value(
    Effect.runSync(Effect.provide(SessionConfig, sessionConfig)).secret
  );

// The request a browser sends with `value` as its session cookie, or with no cookie.
const requestWith = (value: string | undefined) =>
  new Request("https://grifando.example/api/vocabulary", {
    headers:
      value === undefined ? {} : { cookie: `${SESSION_COOKIE}=${value}` },
  });

const identifyLearner = (value: string | undefined) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const identity = yield* LearnerIdentity;
      return yield* identity.identify(requestWith(value));
    }).pipe(
      Effect.provide(LearnerIdentity.hosted.pipe(Layer.provide(sessionConfig)))
    )
  );

describe("getCurrentUserId", () => {
  it("returns the id from a valid signed cookie", async () => {
    expect(
      await identifyLearner(signSessionId("user-1", getSessionSecret()))
    ).toBe("user-1");
  });

  it("throws MissingSessionError for a missing, tampered or wrong-secret cookie", async () => {
    await Promise.all(
      [
        undefined,
        signSessionId("user-1", getSessionSecret()).replace("user-1", "user-2"),
        signSessionId("user-1", "some-other-secret-xxxxxxxxxxxxxxxx"),
      ].map((value) =>
        expect(identifyLearner(value)).rejects.toBeInstanceOf(
          MissingSessionError
        )
      )
    );
  });
});
