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
import { ServerConfig, TrainerConfig } from "@fluenshift/env";
import type { InputLimits } from "@fluenshift/env";
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
import { evaluatePractice, practiceWritingFor } from "./practice-writing";

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
    naturalVersion: "I went back home.",
    naturalnessNotes: [],
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

  it("answers the natural version, and the Naturalness Notes after the Findings' Occurrences", async () => {
    trainer = {
      ...trainer,
      enrichFindings: vi.fn<TrainerMethods["enrichFindings"]>((input) =>
        enriched(input).pipe(
          Effect.map((enrichment) => ({
            ...enrichment,
            naturalnessNotes: [
              {
                example: "I got home late.",
                explanation: "'Got home' is how a fluent speaker says it.",
                l1Transfer: false,
                naturalSpan: "got home",
                originalSpan: "goed home",
                patternKey: "get-home",
              },
              {
                example: "I went back early.",
                explanation: "'Went back' says you returned.",
                l1Transfer: true,
                naturalSpan: "went back",
                originalSpan: "I goed",
                patternKey: "go-back",
              },
            ],
          }))
        )
      ),
    };

    const response = await post({ writingSample: "I goed home." });
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      readonly naturalVersion: unknown;
      readonly occurrences: readonly Record<string, unknown>[];
    };
    expect(body.naturalVersion).toBe("I went back home.");
    expect(
      body.occurrences.map((occurrence) => [
        occurrence["severity"],
        occurrence["category"],
        occurrence["findingPosition"],
        occurrence["originalSpan"],
        occurrence["correctedSpan"],
      ])
    ).toStrictEqual([
      ["ERROR", "VERB_TENSE", 0, "goed", "went"],
      ["UNNATURAL", "UNNATURAL_PHRASING", null, "goed home", "got home"],
      ["UNNATURAL", "UNNATURAL_PHRASING", null, "I goed", "went back"],
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

// The explanation Explain code sends with its snippet; the fake Judge finds its "goed".
const EXPLANATION = "This function goed through every user.";

// The hosted profile's caps, Grifando's: a code snippet of at most 2000 characters
// (docs/adr/0006).
const HOSTED_LIMITS: InputLimits = {
  bodyMaxBytes: 256 * 1024,
  codeMaxCharacters: Option.some(2000),
  promptMaxCharacters: Option.some(1000),
  sampleMaxBytes: 32 * 1024,
  sampleMaxCharacters: Option.some(5000),
};

const LOCAL_LIMITS: InputLimits = {
  ...HOSTED_LIMITS,
  codeMaxCharacters: Option.none(),
  promptMaxCharacters: Option.none(),
  sampleMaxCharacters: Option.none(),
};

const postExplanation = (codeSnippet: string, limits = HOSTED_LIMITS) =>
  createApp({
    limits,
    profile: "local",
    runtime,
    serveWeb: false,
    webDistPath: "unused",
    writePractice: practiceWritingFor,
  }).request(
    new Request("http://localhost/api/practice-writing", {
      body: JSON.stringify({ codeSnippet, writingSample: EXPLANATION }),
      headers: {
        "content-type": "application/json",
        "x-ai-key": SECRET,
        "x-ai-provider": "anthropic",
      },
      method: "POST",
    })
  );

// Ported from Grifando's characterization of the code snippet of POST /api/writing-sessions
// (74dbb9f), port-changed under docs/adr/0038: practice writing takes Explain code's snippet, the
// Deploy Profile's cap bounds it, and only the Trainer receives it, as context for the
// Enrichment.
describe("writing session code snippet", () => {
  it("trims a code snippet and hands up to 2000 characters of it to the analysis", async () => {
    const snippet = "x".repeat(2000);
    const response = await postExplanation(`  ${snippet}\n`);

    expect(response.status).toBe(201);
    expect(trainer.enrichFindings).toHaveBeenCalledWith(
      expect.objectContaining({ codeSnippet: snippet })
    );
  });

  it("answers 400 with the validation issues for a blank code snippet or one over 2000 characters, before any analysis", async () => {
    const blank = await postExplanation("   ");
    const tooLong = await postExplanation("x".repeat(2001));

    expect(blank.status).toBe(400);
    expect(await blank.json()).toMatchObject({
      error: "Invalid request body",
      issues: [expect.objectContaining({ path: ["codeSnippet"] })],
    });
    expect(tooLong.status).toBe(400);
    expect(await tooLong.json()).toMatchObject({
      error: "Invalid request body",
      issues: [expect.objectContaining({ path: ["codeSnippet"] })],
    });
    expect(trainer.enrichFindings).not.toHaveBeenCalled();
  });
});

// The service's own check, behind the route's (HR-02): the Deploy Profile the runtime names caps
// the snippet.
const withHostedCodeCap = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const config = yield* ServerConfig;
    return yield* effect.pipe(
      Effect.provideService(
        ServerConfig,
        ServerConfig.of({
          ...config,
          limits: { ...config.limits, codeMaxCharacters: Option.some(2000) },
        })
      )
    );
  });

describe("Explain code in practice writing", () => {
  it("evaluates the explanation alone: the Judge never receives the snippet", async () => {
    const judging = vi.fn(oneFinding);
    judge = judging;
    const response = await postExplanation("export const marker = 1;");
    const body = (await response.json()) as {
      readonly evaluation: { readonly originalText: string };
    };

    expect(body.evaluation.originalText).toBe(EXPLANATION);
    expect(judging.mock.calls).toStrictEqual([[EXPLANATION]]);
  });

  it("takes a snippet of any length in the local profile, which caps none", async () => {
    const snippet = "x".repeat(5000);
    const response = await postExplanation(snippet, LOCAL_LIMITS);

    expect(response.status).toBe(201);
    expect(trainer.enrichFindings).toHaveBeenCalledWith(
      expect.objectContaining({ codeSnippet: snippet })
    );
  });

  it("refuses a snippet over the profile's cap in the service too, before the Judge runs", async () => {
    const judging = vi.fn(oneFinding);
    judge = judging;
    const refusal = await runtime.runPromise(
      Effect.flip(
        withHostedCodeCap(
          evaluatePractice(trainer, EXPLANATION, "x".repeat(2001))
        )
      )
    );

    expect(refusal).toMatchObject({
      _tag: "InvalidWritingSampleError",
      reason: "Code snippet exceeds 2000 characters",
    });
    expect(judging).not.toHaveBeenCalled();
  });
});
