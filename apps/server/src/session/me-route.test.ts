// Ported from Grifando src/app/api/me/route.test.ts and the characterization of the cookie it
// expires (74dbb9f), as contract tests through `app.request` in the hosted profile: the signed
// session cookie names the Learner, and a fake deleteLearner boundary stands in for deleteUserData.
// A fake limitRequest boundary stands in for rateLimitResponse.
import { DatabaseError } from "@grifando/db";
import { ServerConfig, SessionConfig } from "@grifando/env";
import {
  ConfigProvider,
  Effect,
  Layer,
  ManagedRuntime,
  Redacted,
} from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app";
import type { AppBoundaries } from "../app";
import { CurrentLearner, LearnerIdentity } from "../learner-identity";
import { RateLimitedError } from "./rate-limit";
import { SESSION_COOKIE, signSessionId } from "./session-token";

const fromEnv = (env: Record<string, string>) =>
  ConfigProvider.layer(ConfigProvider.fromEnvRecord(env));

const SECRET = { SESSION_SECRET: "me-route-test-secret-xxxxxxxxxxxxxxxxxxxx" };

// The session settings the hosted profile reads under one NODE_ENV.
const sessionFor = (nodeEnv: string) =>
  Effect.runSync(
    Effect.provide(
      SessionConfig,
      SessionConfig.layer.pipe(
        Layer.provide(fromEnv({ ...SECRET, NODE_ENV: nodeEnv }))
      )
    )
  );

const session = sessionFor("test");

const limitsOf = (env: Record<string, string>) =>
  Effect.runSync(
    Effect.provide(
      ServerConfig,
      ServerConfig.layer.pipe(Layer.provide(fromEnv(env)))
    )
  ).limits;

const hostedRuntime = ManagedRuntime.make(
  LearnerIdentity.hosted.pipe(
    Layer.provide(Layer.succeed(SessionConfig, SessionConfig.of(session)))
  )
);

// Records the Learner each deletion acts for.
const deleted = vi.fn<(learner: string) => void>();

const deleteLearner = () =>
  Effect.gen(function* () {
    const learner = yield* CurrentLearner;
    deleted(learner.id);
  });

const hostedApp = (settings = session, boundaries?: AppBoundaries) =>
  createApp({
    ...(boundaries ?? { deleteLearner }),
    limits: limitsOf({
      DATABASE_URL: "postgres://app@db:5432/app",
      DEPLOY_PROFILE: "hosted",
    }),
    profile: "hosted",
    runtime: hostedRuntime,
    serveWeb: false,
    session: settings,
    siteUrl: "https://fluenshift.example",
    webDistPath: "",
  });

const req = () =>
  new Request("http://test/api/me", {
    headers: {
      cookie: `${SESSION_COOKIE}=${signSessionId("visitor-1", Redacted.value(session.secret))}`,
    },
    method: "DELETE",
  });

beforeEach(() => {
  deleted.mockReset();
});

describe("DELETE /api/me", () => {
  it("deletes the data, expires the cookie and answers 204", async () => {
    const res = await hostedApp().request(req());
    expect(res.status).toBe(204);
    expect(deleted).toHaveBeenCalledWith("visitor-1");
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("ig_session=;");
    expect(cookie.toLowerCase()).toContain("max-age=0");
  });

  it("is rate limited", async () => {
    const res = await hostedApp(session, {
      deleteLearner,
      limitRequest: () =>
        Effect.fail(new RateLimitedError({ retryAfterSeconds: 60 })),
    }).request(req());
    expect(res.status).toBe(429);
    expect(deleted).not.toHaveBeenCalled();
  });

  it("answers the generic 500 and keeps the cookie when the deletion fails", async () => {
    const res = await hostedApp(session, {
      deleteLearner: () =>
        Effect.fail(new DatabaseError({ cause: new Error("unavailable") })),
    }).request(req());
    expect(res.status).toBe(500);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(await res.json()).toEqual({
      code: "internal-error",
      error: "Request could not be completed",
    });
  });

  it("is not a route of the local profile", async () => {
    const res = await createApp({
      deleteLearner,
      limits: limitsOf({ DATA_DIRECTORY: "/data/pglite" }),
      profile: "local",
      runtime: ManagedRuntime.make(LearnerIdentity.local),
      serveWeb: false,
      webDistPath: "",
    }).request(new Request("http://localhost/api/me", { method: "DELETE" }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ code: "not-found", error: "Not Found" });
    expect(deleted).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/me guards", () => {
  it("expires the session cookie as HttpOnly, SameSite=Lax and site-wide, Secure in production only", async () => {
    const developmentResponse = await hostedApp(
      sessionFor("development")
    ).request(req());
    const productionResponse = await hostedApp(
      sessionFor("production")
    ).request(req());
    const development = developmentResponse.headers.get("set-cookie");
    const production = productionResponse.headers.get("set-cookie");

    expect(development).toBe(
      "ig_session=; Path=/; Max-Age=0; HttpOnly; SameSite=lax"
    );
    expect(production).toBe(
      "ig_session=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=lax"
    );
  });
});
