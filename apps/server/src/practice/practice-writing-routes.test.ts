// Practice writing over HTTP (docs/adr/0026): Grifando's POST /api/writing-sessions (74dbb9f),
// whose analysis ADR 0004 retired, becomes POST /api/practice-writing, where the Judge evaluates
// the text as a practice Writing Sample and the Trainer's Enrichment folds its Findings. Also
// ported from Grifando src/server/ai/noKeyInLogs.test.ts: the request's key never reaches a log
// line. The route runs on a fresh PGlite database, a test header names the Learner, a fake Judge
// finds one mistake, a fake Trainer enriches it, and a logger keeps every line the runtime logs.
import { rm } from "node:fs/promises";
import { inspect } from "node:util";

import type { LearnerId } from "@fluenshift/contract";
import { DatabaseError } from "@fluenshift/db";
import { TrainerConfig } from "@fluenshift/env";
import {
  ConfigProvider,
  Effect,
  Layer,
  Logger,
  ManagedRuntime,
  Option,
} from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TrainerClient } from "../academy/trainer/trainer-client";
import type { TrainerMethods } from "../academy/trainer/trainer-model";
import { createApp } from "../app";
import type { AppBoundaries } from "../app";
import {
  EvaluationModel,
  EvaluationModelError,
} from "../evaluation/evaluation-model";
import { LearnerIdentity } from "../learner-identity";
import { makeTemporaryDatabase } from "../test/database";
import { practiceWritingFor } from "./practice-writing";

const SECRET = "sk-secret-123";

const learnerFromHeader = Layer.succeed(
  LearnerIdentity,
  LearnerIdentity.of({
    identify: (request) =>
      Effect.succeed(
        (request.headers.get("x-test-learner") ?? "visitor-1") as LearnerId
      ),
  })
);

// Shaped like an SDK error: a generic Error that carries the request config,
// headers included, as an own property.
const sdkLikeError = () =>
  Object.assign(new Error("Request failed"), {
    request: {
      headers: { authorization: `Bearer ${SECRET}`, "x-api-key": SECRET },
    },
  });

const enriched: TrainerMethods["enrichFindings"] = () =>
  Effect.succeed({
    findings: [
      {
        category: "VERB_TENSE",
        example: "I went home early.",
        l1Transfer: true,
        patternKey: "past-tense-go",
      },
    ],
    model: "test-model",
  });

// The Trainer of every request, and how the client builds it; a case swaps either before it
// posts.
let trainer: TrainerMethods;
let buildTrainer: () => TrainerMethods;
const trainerClient = Layer.succeed(
  TrainerClient,
  TrainerClient.of({
    testKey: () => Effect.succeed("works"),
    trainerFor: () => buildTrainer(),
  })
);

// Grifando's analyzeWriting: the Judge finds one tense mistake, on "goed".
const oneFinding: Parameters<typeof EvaluationModel.fake>[0] = (
  writingSample
) => {
  const byteStart = new TextEncoder().encode(
    writingSample.slice(0, writingSample.indexOf("goed"))
  ).length;
  return Effect.succeed({
    assessment: {
      findings: [
        {
          byteEnd: byteStart + 4,
          byteStart,
          category: "Verb form/tense",
          correction: "went",
          explanation: "'Go' has an irregular past: 'went'.",
          originalText: "goed",
          severity: "Moderate",
        },
      ],
      nonEnglishSpans: [],
      suggestions: [],
      summary: "One verb form mistake.",
    },
    inputTokens: 10,
    latencyMilliseconds: 5,
    model: "judge-model",
    outputTokens: 20,
    provider: "test",
  });
};
let judge = oneFinding;
const judgeModel = EvaluationModel.fake((writingSample) =>
  judge(writingSample)
);

// No key in the configuration: only the request's headers carry one.
const noConfiguredKey = TrainerConfig.layer.pipe(
  Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord({})))
);

// Every line the runtime logs, as a production logger would format it.
let logged: unknown[][];
const keepLogs = Logger.layer([
  Logger.make((options) => {
    logged.push([Logger.formatStructured.log(options)]);
  }),
]);

const runtimeFor = (
  temporary: Awaited<ReturnType<typeof makeTemporaryDatabase>>
) =>
  ManagedRuntime.make(
    Layer.mergeAll(
      temporary.layer,
      judgeModel,
      learnerFromHeader,
      trainerClient,
      noConfiguredKey,
      keepLogs
    )
  );

let database: Awaited<ReturnType<typeof makeTemporaryDatabase>>;
let runtime: ReturnType<typeof runtimeFor>;

beforeEach(async () => {
  judge = oneFinding;
  trainer = {
    continueInterview: vi.fn<TrainerMethods["continueInterview"]>(),
    enrichFindings: vi.fn<TrainerMethods["enrichFindings"]>(enriched),
    explainAttempt: vi.fn<TrainerMethods["explainAttempt"]>(),
    generateExercises: vi.fn<TrainerMethods["generateExercises"]>(),
  };
  buildTrainer = () => trainer;
  logged = [];
  const capture = (...args: unknown[]) => {
    logged.push(args);
  };
  vi.spyOn(console, "error").mockImplementation(capture);
  vi.spyOn(console, "warn").mockImplementation(capture);
  vi.spyOn(console, "log").mockImplementation(capture);
  database = await makeTemporaryDatabase();
  runtime = runtimeFor(database);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await runtime.dispose();
  await rm(database.directory, { force: true, recursive: true });
});

const appOf = (boundaries: AppBoundaries = {}) =>
  createApp({
    limits: {
      bodyMaxBytes: 256 * 1024,
      codeMaxCharacters: Option.none(),
      promptMaxCharacters: Option.none(),
      sampleMaxBytes: 32 * 1024,
      sampleMaxCharacters: Option.none(),
    },
    profile: "local",
    runtime,
    serveWeb: false,
    webDistPath: "unused",
    writePractice: practiceWritingFor,
    ...boundaries,
  });

const post = (body: unknown, headers: Record<string, string> = {}) =>
  appOf().request(
    new Request("http://localhost/api/practice-writing", {
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
        "x-ai-key": SECRET,
        "x-ai-provider": "anthropic",
        ...headers,
      },
      method: "POST",
    })
  );

const expectNoSecretLogged = () => {
  for (const args of logged) {
    for (const arg of args) {
      expect(inspect(arg, { depth: null, showHidden: true })).not.toContain(
        SECRET
      );
    }
  }
};

describe("the visitor's AI key never reaches the logs", () => {
  it("when the provider call throws a generic error", async () => {
    trainer = {
      ...trainer,
      enrichFindings: vi.fn<TrainerMethods["enrichFindings"]>(() =>
        Effect.die(sdkLikeError())
      ),
    };

    const res = await post({ writingSample: "I goed home." });
    expect(res.status).toBe(201);
    expectNoSecretLogged();
  });

  it("when building the provider throws a generic error that reaches the route's log", async () => {
    buildTrainer = () => {
      throw sdkLikeError();
    };

    const res = await post({ writingSample: "I goed home." });
    expect(res.status).toBe(500);
    expect(logged.length).toBeGreaterThan(0);
    expectNoSecretLogged();
  });
});

describe("POST /api/practice-writing", () => {
  it("answers 201 with the Evaluation and the Occurrences its Enrichment recorded", async () => {
    const response = await post({ writingSample: "I goed home." });
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      readonly evaluation: Record<string, unknown>;
      readonly occurrences: readonly unknown[];
      readonly status: string;
    };
    expect(body.status).toBe("evaluated");
    expect(body.evaluation).toMatchObject({
      correctedText: "I went home.",
      originalText: "I goed home.",
      summary: "One verb form mistake.",
    });
    expect(body.occurrences).toEqual([
      {
        category: "VERB_TENSE",
        correctedSpan: "went",
        example: "I went home early.",
        explanation: "'Go' has an irregular past: 'went'.",
        findingPosition: 0,
        id: expect.any(String),
        l1Transfer: true,
        originalSpan: "goed",
        severity: "ERROR",
      },
    ]);
  });

  it("keeps the Evaluation and answers 201 with Grifando's message when the Enrichment fails", async () => {
    trainer = {
      ...trainer,
      enrichFindings: vi.fn<TrainerMethods["enrichFindings"]>(() =>
        Effect.die(new Error("enrichment broke"))
      ),
    };

    const response = await post({ writingSample: "I goed home." });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      evaluationId: expect.any(String),
      message:
        "We couldn't analyze this writing right now. Your text has not been lost — you can try again.",
      status: "failed",
    });
  });

  it("answers 400 with the validation issues for a body without a writing sample", async () => {
    const response = await post({ text: "I goed home." });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "Invalid request body",
      issues: [expect.any(Object)],
    });
  });

  it("answers 401 AI_KEY_REQUIRED without a key, before the Judge runs", async () => {
    const judging = vi.fn(oneFinding);
    judge = judging;
    const response = await post(
      { writingSample: "I goed home." },
      { "x-ai-key": "", "x-ai-provider": "" }
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "AI_KEY_REQUIRED" });
    expect(judging).not.toHaveBeenCalled();
  });

  it("answers a Judge failure as the Evaluation route does", async () => {
    judge = () =>
      Effect.fail(
        new EvaluationModelError({
          kind: "provider-unavailable",
          reason: "The provider is down.",
          recoverable: true,
        })
      );

    const response = await post({ writingSample: "I goed home." });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      code: "provider-unavailable",
      kind: "failure",
      retryable: true,
    });
  });

  it("answers the generic 500 when the database fails", async () => {
    const response = await appOf({
      writePractice: () =>
        Effect.fail(new DatabaseError({ cause: new Error("down") })),
    }).request(
      new Request("http://localhost/api/practice-writing", {
        body: JSON.stringify({ writingSample: "I goed home." }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Something went wrong. Please try again.",
    });
    expect(logged).toContainEqual([
      expect.objectContaining({
        annotations: { error: "DatabaseError" },
        message: "Failed to evaluate practice writing",
      }),
    ]);
  });
});
