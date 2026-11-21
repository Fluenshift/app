// The Writing Desk's Evaluations in the Academy (docs/adr/0041): once the Learner has practiced,
// POST /api/evaluations folds each Evaluation it stores, as practice writing does, so a Finding in
// real text costs mastery (docs/adr/0014). The routes run on a fresh PGlite database, a test
// header names the Learner, a fake Judge makes one Finding, a fake Trainer enriches it, and a
// logger keeps every line the runtime logs.
import { rm } from "node:fs/promises";
import { inspect } from "node:util";

import { LearnerId } from "@fluenshift/contract";
import { TrainerConfig } from "@fluenshift/env";
import {
  ConfigProvider,
  Effect,
  Layer,
  Logger,
  ManagedRuntime,
  Option,
  Schema,
} from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listOccurrencesForEvaluation } from "../academy/occurrence-repository";
import { TrainerClient } from "../academy/trainer/trainer-client";
import { TrainerUnavailableError } from "../academy/trainer/trainer-errors";
import type { TrainerMethods } from "../academy/trainer/trainer-model";
import { createApp } from "../app";
import { EvaluationModel } from "../evaluation/evaluation-model";
import { CurrentLearner, LearnerIdentity } from "../learner-identity";
import { makeTemporaryDatabase } from "../test/database";
import { practiceWritingFor } from "./practice-writing";
import { evaluateWorkFor } from "./work-enrichment";

const LEARNER = "visitor-1";
const KEY_HEADERS = { "x-ai-key": "test-key", "x-ai-provider": "anthropic" };
const WORK_TEXT = "Yesterday I goed to the office.";

const learnerFromHeader = Layer.succeed(
  LearnerIdentity,
  LearnerIdentity.of({
    identify: (request) =>
      Effect.succeed(
        (request.headers.get("x-test-learner") ?? LEARNER) as LearnerId
      ),
  })
);

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

// The Trainer of every request.
let trainer: TrainerMethods;
const trainerClient = Layer.succeed(
  TrainerClient,
  TrainerClient.of({
    testKey: () => Effect.succeed("works"),
    trainerFor: () => trainer,
  })
);

// The Judge makes one Finding of tense, on "goed".
const judgeModel = EvaluationModel.fake((writingSample) => {
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
});

// No key in the configuration: only the request's headers carry one.
const noConfiguredKey = TrainerConfig.layer.pipe(
  Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord({})))
);

// Every line the runtime logs, as a production logger would format it.
let logged: unknown[];
const keepLogs = Logger.layer([
  Logger.make((options) => {
    logged.push(Logger.formatStructured.log(options));
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
  trainer = {
    continueInterview: vi.fn<TrainerMethods["continueInterview"]>(),
    enrichFindings: vi.fn<TrainerMethods["enrichFindings"]>(enriched),
    explainAttempt: vi.fn<TrainerMethods["explainAttempt"]>(),
    generateExercises: vi.fn<TrainerMethods["generateExercises"]>(),
  };
  logged = [];
  database = await makeTemporaryDatabase();
  runtime = runtimeFor(database);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await runtime.dispose();
  await rm(database.directory, { force: true, recursive: true });
});

const app = () =>
  createApp({
    evaluateWriting: (writingSample, headers) =>
      evaluateWorkFor(headers, writingSample),
    limits: {
      bodyMaxBytes: 256 * 1024,
      codeMaxCharacters: Option.none(),
      sampleMaxBytes: 32 * 1024,
      sampleMaxCharacters: Option.none(),
    },
    profile: "local",
    runtime,
    serveWeb: false,
    webDistPath: "unused",
    writePractice: practiceWritingFor,
  });

const post = (
  path: string,
  writingSample: string,
  headers: Record<string, string>
) =>
  app().request(
    new Request(`http://localhost${path}`, {
      body: JSON.stringify({ writingSample }),
      headers: { "content-type": "application/json", ...headers },
      method: "POST",
    })
  );

const practice = () =>
  post("/api/practice-writing", "I goed home early.", KEY_HEADERS);

// The Writing Desk's answer, and the id of the Evaluation it created.
const writeAtDesk = async (headers: Record<string, string> = KEY_HEADERS) => {
  const response = await post("/api/evaluations", WORK_TEXT, headers);
  const body = (await response.json()) as {
    readonly evaluation?: { readonly id: string };
    readonly kind: string;
  };
  return { body, status: response.status };
};

const occurrencesOf = (evaluationId: string) =>
  runtime.runPromise(
    listOccurrencesForEvaluation(evaluationId).pipe(
      Effect.provideService(
        CurrentLearner,
        CurrentLearner.of({ id: Schema.decodeSync(LearnerId)(LEARNER) })
      )
    )
  );

const linesAbout = (message: string) =>
  logged
    .map((line) => inspect(line, { depth: null }))
    .filter((line) => line.includes(message));

describe("the Writing Desk's Evaluations in the Academy", () => {
  it("folds a Writing Desk Evaluation into the Learner's Mistake Patterns once they have practiced", async () => {
    await practice();
    const desk = await writeAtDesk();
    const occurrences = await occurrencesOf(desk.body.evaluation?.id ?? "");

    expect(desk.status).toBe(201);
    expect(trainer.enrichFindings).toHaveBeenCalledTimes(2);
    expect(
      vi.mocked(trainer.enrichFindings).mock.calls[1]?.[0].writingSample
    ).toBe(WORK_TEXT);
    expect(occurrences.map((occurrence) => occurrence.category)).toStrictEqual([
      "VERB_TENSE",
    ]);
  });

  it("leaves a Writing Desk Evaluation out of the Academy until the Learner has practiced", async () => {
    const desk = await writeAtDesk();

    expect(desk.status).toBe(201);
    expect(trainer.enrichFindings).not.toHaveBeenCalled();
  });

  it("leaves a Writing Desk Evaluation out of the Academy when no Trainer key is available", async () => {
    await practice();
    const desk = await writeAtDesk({});

    expect(desk.status).toBe(201);
    expect(trainer.enrichFindings).toHaveBeenCalledTimes(1);
  });

  it("answers a Writing Desk Evaluation whose Enrichment fails or dies, and logs each by its tag or name alone", async () => {
    await practice();
    vi.mocked(trainer.enrichFindings).mockImplementationOnce(() =>
      Effect.fail(new TrainerUnavailableError())
    );
    const failed = await writeAtDesk();
    vi.mocked(trainer.enrichFindings).mockImplementationOnce(() =>
      Effect.die(new RangeError("Enrichment broke on goed"))
    );
    const died = await writeAtDesk();
    const lines = linesAbout("work-enrichment");

    expect(failed.status).toBe(201);
    expect(failed.body.kind).toBe("created");
    expect(died.status).toBe(201);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("TrainerUnavailableError");
    expect(lines[1]).toContain("RangeError");
    expect(lines.join("\n")).not.toContain("goed");
  });
});
