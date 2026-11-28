// Ported from Grifando's characterization src/app/api/rateLimitFirst.characterization.test.ts and the
// rate-limit case of src/app/api/ai-key/test/route.test.ts (74dbb9f), as contract tests through
// `app.request` in the hosted profile: a fake limitRequest boundary stands in for
// rateLimitResponse and refuses every call, and a fake ensureLearner for ensureUser. The routes'
// own boundaries must never run. With the buckets of PE's routes (docs/adr/0033).
import { DatabaseError } from "@grifando/db";
import { ServerConfig, SessionConfig } from "@grifando/env";
import {
  ConfigProvider,
  Effect,
  Layer,
  ManagedRuntime,
  Option,
  Redacted,
} from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TrainerKeyRequiredError } from "../academy/trainer/trainer-errors";
import { createApp } from "../app";
import type { AppBoundaries } from "../app";
import { JudgeKey } from "../evaluation/evaluation-model";
import { CurrentLearner, LearnerIdentity } from "../learner-identity";
import { RateLimitedError } from "./rate-limit";
import type { RateLimitBucket } from "./rate-limit";
import { SESSION_COOKIE, signSessionId } from "./session-token";

const fromEnv = (env: Record<string, string>) =>
  ConfigProvider.layer(ConfigProvider.fromEnvRecord(env));

const session = Effect.runSync(
  Effect.provide(
    SessionConfig,
    SessionConfig.layer.pipe(
      Layer.provide(
        fromEnv({ SESSION_SECRET: "rate-limit-test-secret-xxxxxxxxxxxxxxxxxx" })
      )
    )
  )
);

const { limits } = Effect.runSync(
  Effect.provide(
    ServerConfig,
    ServerConfig.layer.pipe(
      Layer.provide(
        fromEnv({
          DATABASE_URL: "postgres://app@db:5432/app",
          DEPLOY_PROFILE: "hosted",
        })
      )
    )
  )
);

const runtime = ManagedRuntime.make(
  LearnerIdentity.hosted.pipe(
    Layer.provide(Layer.succeed(SessionConfig, SessionConfig.of(session)))
  )
);

// The Learner and the bucket of each call the rate limit counted, in order.
const limitedFor = vi.fn<(learner: string, bucket: RateLimitBucket) => void>();
// Each step of an admitted call, in order.
const steps = vi.fn<(step: string) => void>();
// Records each run of ensureLearner, Grifando's ensureUser.
const learnerEnsured = vi.fn();
const ensureLearner = () =>
  Effect.sync(() => {
    learnerEnsured();
    steps("ensure");
  });
// Records each run of a boundary the rate limit must keep a refused call from; building its
// Effect runs nothing.
const reached = vi.fn();
const unreached = () =>
  Effect.sync(() => {
    reached();
  }).pipe(Effect.andThen(Effect.die(new Error("unreached"))));

const limitWith =
  (
    answer: Effect.Effect<void, DatabaseError | RateLimitedError>
  ): NonNullable<AppBoundaries["limitRequest"]> =>
  (_headers, bucket) =>
    Effect.gen(function* () {
      const learner = yield* CurrentLearner;
      limitedFor(learner.id, bucket);
      steps("limit");
      return yield* answer;
    });

const refuse = limitWith(
  Effect.fail(new RateLimitedError({ retryAfterSeconds: 60 }))
);

const routes: AppBoundaries = {
  answerInterviewTurn: unreached,
  deleteEvaluation: unreached,
  deleteLearner: unreached,
  endInterview: unreached,
  evaluateWriting: unreached,
  explainAttempt: unreached,
  generateExercises: unreached,
  getProgressEvidence: unreached,
  startInterview: unreached,
  submitAttempt: unreached,
  testTrainerKey: unreached,
  writePractice: unreached,
};

const hostedApp = (boundaries: AppBoundaries) =>
  createApp({
    ...routes,
    ensureLearner,
    ...boundaries,
    limits,
    profile: "hosted",
    runtime,
    serveWeb: false,
    session,
    siteUrl: "https://grifando.example",
    webDistPath: "",
  });

// An OpenRouter key: in the hosted profile it runs the Trainer and the Judge (docs/adr/0035).
const AI_HEADERS = { "x-ai-key": "test-key", "x-ai-provider": "openrouter" };

const request = (
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {}
) =>
  new Request(`http://test${path}`, {
    headers: {
      "content-type": "application/json",
      cookie: `${SESSION_COOKIE}=${signSessionId("visitor-1", Redacted.value(session.secret))}`,
      ...headers,
    },
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

// Each call's status, the calls made one after the other.
const statusesInOrder = async (
  calls: readonly (readonly [string, () => Response | Promise<Response>])[],
  statuses: Readonly<Record<string, number>> = {}
): Promise<Readonly<Record<string, number>>> => {
  const [first, ...rest] = calls;
  if (first === undefined) {
    return statuses;
  }
  const [name, call] = first;
  const response = await call();
  return statusesInOrder(rest, { ...statuses, [name]: response.status });
};

beforeEach(() => {
  limitedFor.mockReset();
  steps.mockReset();
  learnerEnsured.mockReset();
  reached.mockReset();
});

describe("rate limit before the user", () => {
  it("refuses every state-changing route at its rate limit before creating the visitor's user", async () => {
    const app = hostedApp({ limitRequest: refuse });
    const calls: [string, () => Response | Promise<Response>][] = [
      [
        "POST /api/ai-key/test",
        () => app.request(request("POST", "/api/ai-key/test", {}, AI_HEADERS)),
      ],
      [
        "POST /api/exercises/[id]/attempts/[attemptId]/explanation",
        () =>
          app.request(
            request(
              "POST",
              "/api/exercises/exercise-1/attempts/attempt-1/explanation",
              {},
              AI_HEADERS
            )
          ),
      ],
      [
        "POST /api/exercises/[id]/attempts",
        () =>
          app.request(
            request("POST", "/api/exercises/exercise-1/attempts", {
              answer: "I depend on it.",
            })
          ),
      ],
      [
        "POST /api/exercises",
        () => app.request(request("POST", "/api/exercises", {}, AI_HEADERS)),
      ],
      [
        "POST /api/interview/[id]/end",
        () => app.request(request("POST", "/api/interview/interview-1/end")),
      ],
      [
        "POST /api/interview/[id]/turns/[turnId]/answer",
        () =>
          app.request(
            request(
              "POST",
              "/api/interview/interview-1/turns/turn-1/answer",
              { answer: "I would split the service." },
              AI_HEADERS
            )
          ),
      ],
      [
        "POST /api/interview",
        () => app.request(request("POST", "/api/interview", {}, AI_HEADERS)),
      ],
      ["DELETE /api/me", () => app.request(request("DELETE", "/api/me"))],
      [
        "POST /api/writing-sessions",
        () =>
          app.request(
            request(
              "POST",
              "/api/practice-writing",
              { writingSample: "I depend of this library." },
              AI_HEADERS
            )
          ),
      ],
    ];

    const statuses = await statusesInOrder(calls);

    expect(statuses).toEqual(
      Object.fromEntries(calls.map(([name]) => [name, 429]))
    );
    expect(limitedFor.mock.calls.map(([, bucket]) => bucket)).toEqual([
      "keyTest",
      "analysis",
      "write",
      "generation",
      "write",
      "analysis",
      "generation",
      "write",
      "analysis",
    ]);
    expect(learnerEnsured).not.toHaveBeenCalled();
    expect(reached).not.toHaveBeenCalled();
  });

  it("admits a call in order: the limit, then the Learner's row, then the route's work", async () => {
    const response = await hostedApp({
      deleteEvaluation: () =>
        Effect.sync(() => {
          steps("work");
        }),
      limitRequest: limitWith(Effect.void),
    }).request(request("DELETE", "/api/evaluations/evaluation-1"));
    expect(response.status).toBe(204);
    expect(steps.mock.calls.map(([step]) => step)).toEqual([
      "limit",
      "ensure",
      "work",
    ]);
  });

  it("answers Grifando's 429 with the seconds to wait", async () => {
    const response = await hostedApp({ limitRequest: refuse }).request(
      request("DELETE", "/api/evaluations/evaluation-1")
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(await response.json()).toEqual({
      error: "You're going a bit fast. Wait a moment and try again.",
    });
  });

  it("counts an Evaluation against the analysis limits and its deletion against the write limit", async () => {
    const app = hostedApp({ limitRequest: refuse });
    const evaluation = await app.request(
      request(
        "POST",
        "/api/evaluations",
        { writingSample: "A sample." },
        AI_HEADERS
      )
    );
    const deletion = await app.request(
      request("DELETE", "/api/evaluations/evaluation-1")
    );
    expect(evaluation.status).toBe(429);
    expect(evaluation.headers.get("x-correlation-id")).not.toBeNull();
    expect(deletion.status).toBe(429);
    expect(limitedFor.mock.calls.map(([, bucket]) => bucket)).toEqual([
      "analysis",
      "write",
    ]);
    expect(reached).not.toHaveBeenCalled();
  });

  it("counts no read, Progress evidence included", async () => {
    const app = hostedApp({
      getProgressEvidence: () => Effect.succeed({}),
      limitRequest: refuse,
      listPendingExercises: () => Effect.succeed([]),
    });
    const evidence = await app.request(
      request("POST", "/api/progress/evidence", {
        period: "7-days",
        selection: { kind: "average-score" },
      })
    );
    const exercises = await app.request(request("GET", "/api/exercises"));
    expect(evidence.status).toBe(200);
    expect(exercises.status).toBe(200);
    expect(limitedFor).not.toHaveBeenCalled();
  });

  it("counts no Trainer call that carries no key, which its route answers for the key", async () => {
    const response = await hostedApp({
      limitRequest: refuse,
      startInterview: () => Effect.fail(new TrainerKeyRequiredError()),
    }).request(request("POST", "/api/interview"));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "AI_KEY_REQUIRED" });
    expect(limitedFor).not.toHaveBeenCalled();
  });

  it("answers the generic 500 when the limits of an Evaluation or a key test cannot be read", async () => {
    const app = hostedApp({
      limitRequest: limitWith(
        Effect.fail(new DatabaseError({ cause: new Error("unavailable") }))
      ),
    });
    const evaluation = await app.request(
      request(
        "POST",
        "/api/evaluations",
        { writingSample: "A sample." },
        AI_HEADERS
      )
    );
    const keyTest = await app.request(
      request("POST", "/api/ai-key/test", {}, AI_HEADERS)
    );
    expect(evaluation.status).toBe(500);
    expect(keyTest.status).toBe(500);
    expect(await keyTest.json()).toEqual({
      code: "internal-error",
      error: "Request could not be completed",
    });
  });
});

describe("POST /api/ai-key/test", () => {
  it("passes the rate limiter's 429 through without calling the provider", async () => {
    const provider = vi.fn();
    const testTrainerKey = () =>
      Effect.sync(() => {
        provider();
        return "works" as const;
      });
    const res = await hostedApp({
      limitRequest: refuse,
      testTrainerKey,
    }).request(request("POST", "/api/ai-key/test", undefined, AI_HEADERS));
    expect(res.status).toBe(429);
    expect(limitedFor).toHaveBeenCalledWith("visitor-1", "keyTest");
    expect(provider).not.toHaveBeenCalled();
  });
});

// The hosted profile's Judge runs on the visitor's OpenRouter key (docs/adr/0035): a route that
// runs it answers for the key before its rate limit, as a Trainer route does.
describe("the hosted Judge's key", () => {
  const GEMINI_HEADERS = { "x-ai-key": "test-key", "x-ai-provider": "gemini" };
  // ADR 0035, decision 4: the answer asks for an OpenRouter key in Settings.
  const JUDGE_KEY_REQUIRED = {
    code: "AI_JUDGE_KEY_REQUIRED",
    error:
      "Set up an OpenRouter key in Settings to get feedback on your writing.",
  };
  const sample = { writingSample: "I depend of this library." };
  const answer = { answer: "I would split the service." };
  const ANSWER_PATH = "/api/interview/interview-1/turns/turn-1/answer";

  it("answers AI_JUDGE_KEY_REQUIRED, uncounted, to an Evaluation without an OpenRouter key", async () => {
    const app = hostedApp({ limitRequest: limitWith(Effect.void) });

    const keyless = await app.request(
      request("POST", "/api/evaluations", sample)
    );
    const gemini = await app.request(
      request("POST", "/api/evaluations", sample, GEMINI_HEADERS)
    );

    expect(keyless.status).toBe(401);
    expect(await keyless.json()).toStrictEqual(JUDGE_KEY_REQUIRED);
    expect(gemini.status).toBe(401);
    expect(keyless.headers.get("x-correlation-id")).not.toBeNull();
    expect(limitedFor).not.toHaveBeenCalled();
    expect(reached).not.toHaveBeenCalled();
  });

  // One OpenRouter key runs both models, so a call that runs both and carries no key asks for
  // that key, not for any Trainer key (docs/adr/0035, decision 4; #251).
  it("answers AI_JUDGE_KEY_REQUIRED, uncounted, to practice writing and an interview answer without a key", async () => {
    const app = hostedApp({ limitRequest: limitWith(Effect.void) });

    const practice = await app.request(
      request("POST", "/api/practice-writing", sample)
    );
    const interview = await app.request(request("POST", ANSWER_PATH, answer));

    expect(practice.status).toBe(401);
    expect(await practice.json()).toStrictEqual(JUDGE_KEY_REQUIRED);
    expect(interview.status).toBe(401);
    expect(await interview.json()).toStrictEqual(JUDGE_KEY_REQUIRED);
    expect(limitedFor).not.toHaveBeenCalled();
    expect(reached).not.toHaveBeenCalled();
  });

  it("answers AI_JUDGE_KEY_REQUIRED, uncounted, to practice writing and an interview answer on a Gemini key", async () => {
    const app = hostedApp({ limitRequest: limitWith(Effect.void) });

    const practice = await app.request(
      request("POST", "/api/practice-writing", sample, GEMINI_HEADERS)
    );
    const interview = await app.request(
      request("POST", ANSWER_PATH, answer, GEMINI_HEADERS)
    );

    expect(practice.status).toBe(401);
    expect(await practice.json()).toMatchObject({
      code: "AI_JUDGE_KEY_REQUIRED",
    });
    expect(interview.status).toBe(401);
    expect(await interview.json()).toMatchObject({
      code: "AI_JUDGE_KEY_REQUIRED",
    });
    expect(limitedFor).not.toHaveBeenCalled();
    expect(reached).not.toHaveBeenCalled();
  });

  // A key that cannot be read is the Learner's to fix in Settings, as Grifando answered it on
  // every route that read a key (src/server/ai/aiErrorResponse.ts, 74dbb9f); only a missing key
  // or another provider's asks for an OpenRouter key (#263).
  it("answers AI_KEY_INVALID, uncounted, to practice writing and an interview answer on a malformed key", async () => {
    const MALFORMED_HEADERS = {
      "x-ai-key": "not a key",
      "x-ai-provider": "openrouter",
    };
    const KEY_INVALID = {
      code: "AI_KEY_INVALID",
      error: "That AI key doesn't look right. Check it in Settings.",
    };
    const app = hostedApp({ limitRequest: limitWith(Effect.void) });

    const practice = await app.request(
      request("POST", "/api/practice-writing", sample, MALFORMED_HEADERS)
    );
    const interview = await app.request(
      request("POST", ANSWER_PATH, answer, MALFORMED_HEADERS)
    );

    expect(practice.status).toBe(400);
    expect(await practice.json()).toStrictEqual(KEY_INVALID);
    expect(interview.status).toBe(400);
    expect(await interview.json()).toStrictEqual(KEY_INVALID);
    expect(limitedFor).not.toHaveBeenCalled();
    expect(reached).not.toHaveBeenCalled();
  });

  it("runs every route of the Judge on the visitor's OpenRouter key, after its limit", async () => {
    const judgeKeys = vi.fn<(key: string | null) => void>();
    const judged = () =>
      Effect.serviceOption(JudgeKey).pipe(
        Effect.flatMap((key) =>
          Effect.sync(() => {
            judgeKeys(
              Option.isSome(key) ? Redacted.value(key.value.apiKey) : null
            );
          })
        ),
        Effect.andThen(Effect.die(new Error("judged")))
      );
    const app = hostedApp({
      answerInterviewTurn: judged,
      evaluateWriting: judged,
      limitRequest: limitWith(Effect.void),
      writePractice: judged,
    });

    await app.request(request("POST", "/api/evaluations", sample, AI_HEADERS));
    await app.request(
      request("POST", "/api/practice-writing", sample, AI_HEADERS)
    );
    await app.request(request("POST", ANSWER_PATH, answer, AI_HEADERS));

    expect(judgeKeys.mock.calls).toStrictEqual([
      ["test-key"],
      ["test-key"],
      ["test-key"],
    ]);
    expect(limitedFor.mock.calls.map(([, bucket]) => bucket)).toStrictEqual([
      "analysis",
      "analysis",
      "analysis",
    ]);
  });
});
