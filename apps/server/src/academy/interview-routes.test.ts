// Ported from Grifando's characterization of the interview routes (74dbb9f,
// migration/characterization/grifando/files/src/app/api/interview): starting a session, reading
// it and ending it. Under docs/adr/0010 an answer is a practice Writing Sample, so a turn names
// its Evaluation instead of carrying a writing analysis, and its answer is read through that
// Evaluation. The routes run on a fresh PGlite database, a test header names the Learner, and a
// fake Trainer asks the questions.
import { rm } from "node:fs/promises";

import { AIResponseValidationError } from "@fluenshift/contract";
import type { LearnerId } from "@fluenshift/contract";
import { Database, evaluations } from "@fluenshift/db";
import { TrainerConfig } from "@fluenshift/env";
import { eq } from "drizzle-orm";
import { ConfigProvider, Effect, Layer, ManagedRuntime, Option } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app";
import {
  EvaluationModel,
  EvaluationModelError,
} from "../evaluation/evaluation-model";
import { LearnerIdentity } from "../learner-identity";
import { answerInterviewTurnFor } from "../practice/practice-writing";
import { makeTemporaryDatabase } from "../test/database";
import { startInterviewFor } from "./academy-requests";
import { endInterview, getSession } from "./interview-service";
import { TrainerClient } from "./trainer/trainer-client";
import type { TrainerMethods } from "./trainer/trainer-model";

const learnerFromHeader = Layer.succeed(
  LearnerIdentity,
  LearnerIdentity.of({
    identify: (request) =>
      Effect.succeed(
        (request.headers.get("x-test-learner") ?? "visitor-1") as LearnerId
      ),
  })
);

// Grifando's fakeProvider: every question is the same.
const trainer: TrainerMethods = {
  continueInterview: vi.fn<TrainerMethods["continueInterview"]>(() =>
    Effect.succeed({
      model: "test-model",
      question: "What did you work on recently?",
    })
  ),
  enrichFindings: vi.fn<TrainerMethods["enrichFindings"]>(() =>
    Effect.succeed({
      findings: [
        {
          category: "VERB_TENSE",
          example: "I worked on a payments API.",
          l1Transfer: false,
          patternKey: "work-on-project",
        },
      ],
      model: "test-model",
    })
  ),
  explainAttempt: vi.fn<TrainerMethods["explainAttempt"]>(),
  generateExercises: vi.fn<TrainerMethods["generateExercises"]>(),
};

const trainerClient = Layer.succeed(
  TrainerClient,
  TrainerClient.of({
    testKey: () => Effect.succeed("works"),
    trainerFor: () => trainer,
  })
);

// Grifando's analyzeWriting: the Judge finds one tense mistake, on "work", in every answer.
const oneFinding: Parameters<typeof EvaluationModel.fake>[0] = (
  writingSample
) => {
  const byteStart = new TextEncoder().encode(
    writingSample.slice(0, writingSample.indexOf("work"))
  ).length;
  return Effect.succeed({
    assessment: {
      findings: [
        {
          byteEnd: byteStart + 4,
          byteStart,
          category: "Verb form/tense",
          correction: "worked",
          explanation: "Use the past tense for finished work.",
          originalText: "work",
          severity: "Minor",
        },
      ],
      nonEnglishSpans: [],
      suggestions: [],
      summary: "One tense mistake.",
    },
    inputTokens: 10,
    latencyMilliseconds: 5,
    model: "judge-model",
    outputTokens: 20,
    provider: "test",
  });
};

// The Judge of every request; a case swaps it before it posts.
let judge = oneFinding;

const judgeModel = EvaluationModel.fake((writingSample) =>
  judge(writingSample)
);

// No key in the configuration: only the request's headers carry one.
const noConfiguredKey = TrainerConfig.layer.pipe(
  Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord({})))
);

const runtimeFor = (
  temporary: Awaited<ReturnType<typeof makeTemporaryDatabase>>
) =>
  ManagedRuntime.make(
    Layer.mergeAll(
      temporary.layer,
      judgeModel,
      learnerFromHeader,
      trainerClient,
      noConfiguredKey
    )
  );

let database: Awaited<ReturnType<typeof makeTemporaryDatabase>>;
let runtime: ReturnType<typeof runtimeFor>;

beforeEach(async () => {
  judge = oneFinding;
  database = await makeTemporaryDatabase();
  runtime = runtimeFor(database);
});

afterEach(async () => {
  await runtime.dispose();
  await rm(database.directory, { force: true, recursive: true });
});

const appOf = () =>
  createApp({
    answerInterviewTurn: answerInterviewTurnFor,
    endInterview,
    getInterviewSession: getSession,
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
    startInterview: startInterviewFor,
    webDistPath: "unused",
  });

const AI_HEADERS = { "x-ai-key": "test-key", "x-ai-provider": "gemini" };
// Grifando's holder.userId = "other-user".
const OTHER_LEARNER = { "x-test-learner": "other-user" };

// Grifando's json(): a request without a body.
const send = (
  method: string,
  path: string,
  headers: Record<string, string> = {}
) =>
  appOf().request(
    new Request(`http://localhost${path}`, {
      headers: { "content-type": "application/json", ...headers },
      method,
    })
  );

const start = async () => {
  const response = await send("POST", "/api/interview", AI_HEADERS);
  const body = (await response.json()) as {
    sessionId: string;
    turn: { id: string };
  };
  return { body, response };
};

// Ported from the same characterization: answering a turn. Under docs/adr/0010 the answer is a
// practice Writing Sample, so the turn answers with its Evaluation instead of Grifando's
// analysis, and Grifando's FAILED writing session is the Evaluation whose Enrichment failed
// (docs/adr/0024).
const ANSWER = { answer: "I work in a payments API." };

const answer = (
  started: {
    readonly sessionId: string;
    readonly turn: { readonly id: string };
  },
  body: unknown,
  headers: Record<string, string> = AI_HEADERS
) =>
  appOf().request(
    new Request(
      `http://localhost/api/interview/${started.sessionId}/turns/${started.turn.id}/answer`,
      {
        body: JSON.stringify(body),
        headers: { "content-type": "application/json", ...headers },
        method: "POST",
      }
    )
  );

const keys = (value: unknown) =>
  Object.keys(value as object)
    .toSorted()
    .join(", ");

describe("interview routes", () => {
  it("starts a session with its opening question", async () => {
    const { response, body } = await start();
    expect(response.status).toBe(201);
    expect(body).toEqual({
      sessionId: expect.any(String),
      turn: {
        id: expect.any(String),
        order: 0,
        question: "What did you work on recently?",
      },
    });
    const withoutKey = await send("POST", "/api/interview");
    expect(withoutKey.status).toBe(401);
    expect(await withoutKey.json()).toMatchObject({ code: "AI_KEY_REQUIRED" });
  });

  it("reads a session with its turns, and 404s for an unknown or another user's session", async () => {
    const { body } = await start();
    const read = await send("GET", `/api/interview/${body.sessionId}`);
    expect(read.status).toBe(200);
    expect(await read.json()).toEqual({
      id: body.sessionId,
      status: "ACTIVE",
      turns: [
        {
          answer: null,
          evaluationId: null,
          id: body.turn.id,
          order: 0,
          question: "What did you work on recently?",
        },
      ],
    });

    const foreign = await send(
      "GET",
      `/api/interview/${body.sessionId}`,
      OTHER_LEARNER
    );
    const unknown = await send("GET", "/api/interview/missing", OTHER_LEARNER);
    expect([foreign.status, unknown.status]).toEqual([404, 404]);
    expect(await foreign.json()).toEqual({ error: "Not found" });
  });

  it("ends a session once, and 404s for an unknown or another user's session", async () => {
    const { body } = await start();
    const ended = await send("POST", `/api/interview/${body.sessionId}/end`);
    expect(ended.status).toBe(200);
    expect(await ended.json()).toEqual({ status: "ended" });

    const foreign = await send(
      "POST",
      `/api/interview/${body.sessionId}/end`,
      OTHER_LEARNER
    );
    const unknown = await send(
      "POST",
      "/api/interview/missing/end",
      OTHER_LEARNER
    );
    expect([foreign.status, unknown.status]).toEqual([404, 404]);
    expect(await unknown.json()).toEqual({ error: "Not found" });
  });

  it("answers a turn with its analysis and the next question", async () => {
    const { body } = await start();
    const response = await answer(body, ANSWER);
    expect(response.status).toBe(200);
    const answered = (await response.json()) as {
      evaluation: unknown;
      nextTurn: unknown;
      status: string;
    };
    expect(answered.status).toBe("answered");
    expect(answered.nextTurn).toEqual({
      id: expect.any(String),
      order: 1,
      question: "What did you work on recently?",
    });
    expect(keys(answered.evaluation)).toBe(
      "band, correctedText, evaluatedAt, evaluatedEnglishWordCount, findings, id, model, originalText, provider, rubricVersion, score, suggestions, summary"
    );
  });

  it("returns the FAILED writing session when the analysis fails, and validates the answer", async () => {
    const { body } = await start();
    vi.mocked(trainer.enrichFindings).mockReturnValueOnce(
      Effect.die(new Error("private cause"))
    );
    const failed = await answer(body, ANSWER);
    expect(failed.status).toBe(200);
    expect(await failed.json()).toEqual({
      evaluationId: expect.any(String),
      message: expect.any(String),
      status: "failed",
    });

    const empty = await answer(body, { answer: "" });
    expect(empty.status).toBe(400);
    expect(await empty.json()).toMatchObject({
      error: "Invalid request body",
      issues: [expect.any(Object)],
    });
  });

  it("answers 404 to another user's turn", async () => {
    const { body } = await start();
    const response = await answer(body, ANSWER, {
      ...AI_HEADERS,
      ...OTHER_LEARNER,
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  });
});

// Grifando's start route answers its generic 500 for an answer the Trainer's schema refuses and
// for anything unexpected (src/app/api/interview/route.ts, 74dbb9f); no Grifando test covers it.
describe("POST /api/interview failures", () => {
  it("answers the generic 500 when the opening question fails", async () => {
    const continueInterview = vi.mocked(trainer.continueInterview);
    continueInterview.mockReturnValueOnce(
      Effect.fail(
        new AIResponseValidationError({ issues: [], message: "bad shape" })
      )
    );
    const refused = await start();
    continueInterview.mockReturnValueOnce(
      Effect.die(new Error("private cause"))
    );
    const crashed = await start();
    expect([refused.response.status, crashed.response.status]).toEqual([
      500, 500,
    ]);
    expect([refused.body, crashed.body]).toEqual([
      { error: "Something went wrong. Please try again." },
      { error: "Something went wrong. Please try again." },
    ]);
  });
});

// docs/adr/0024: a Judge failure records nothing and answers as the Evaluation route does, so
// the turn stays open for the same answer.
describe("POST /api/interview answers when the Judge fails", () => {
  it("answers the Evaluation route's failure and leaves the turn open", async () => {
    const { body } = await start();
    judge = () =>
      Effect.fail(
        new EvaluationModelError({
          kind: "provider-unavailable",
          reason: "busy",
          recoverable: true,
        })
      );
    const failed = await answer(body, ANSWER);
    expect(failed.status).toBe(503);
    expect(await failed.json()).toEqual({
      code: "provider-unavailable",
      kind: "failure",
      retryable: true,
    });
    const read = await send("GET", `/api/interview/${body.sessionId}`);
    expect(await read.json()).toMatchObject({
      turns: [{ answer: null, evaluationId: null, order: 0 }],
    });
  });
});

// docs/adr/0010: an interview answer is a practice Writing Sample, which no route shows yet, so
// the case reads the origin the Evaluation recorded.
describe("POST /api/interview answers as practice writing", () => {
  it("records the answer as a practice Writing Sample", async () => {
    const { body } = await start();
    const response = await answer(body, ANSWER);
    const { evaluation } = (await response.json()) as {
      evaluation: { id: string };
    };
    const recorded = await runtime.runPromise(
      Effect.gen(function* () {
        const service = yield* Database;
        return yield* service.run((client) =>
          client
            .select({ origin: evaluations.origin })
            .from(evaluations)
            .where(eq(evaluations.id, evaluation.id))
        );
      })
    );
    expect(recorded).toEqual([{ origin: "practice" }]);
  });
});

// Grifando's answer route resolves the key after the body and before the analysis
// (src/app/api/interview/[id]/turns/[turnId]/answer/route.ts, 74dbb9f); no Grifando test covers it.
describe("POST /api/interview answers without a key", () => {
  it("answers 401 AI_KEY_REQUIRED before the Judge runs", async () => {
    const { body } = await start();
    const evaluate = vi.fn(oneFinding);
    judge = evaluate;
    const response = await answer(body, ANSWER, {});
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "AI_KEY_REQUIRED" });
    expect(evaluate).not.toHaveBeenCalled();
  });
});
