// Ported from Grifando's characterization of the interview routes (74dbb9f,
// migration/characterization/grifando/files/src/app/api/interview): starting a session, reading
// it and ending it. Under docs/adr/0010 an answer is a practice Writing Sample, so a turn names
// its Evaluation instead of carrying a writing analysis, and its answer is read through that
// Evaluation. The routes run on a fresh PGlite database, a test header names the Learner, and a
// fake Trainer asks the questions.
import { rm } from "node:fs/promises";

import { AIResponseValidationError } from "@fluenshift/contract";
import type { LearnerId } from "@fluenshift/contract";
import { TrainerConfig } from "@fluenshift/env";
import { ConfigProvider, Effect, Layer, ManagedRuntime, Option } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app";
import { LearnerIdentity } from "../learner-identity";
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
  enrichFindings: vi.fn<TrainerMethods["enrichFindings"]>(),
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
      learnerFromHeader,
      trainerClient,
      noConfiguredKey
    )
  );

let database: Awaited<ReturnType<typeof makeTemporaryDatabase>>;
let runtime: ReturnType<typeof runtimeFor>;

beforeEach(async () => {
  database = await makeTemporaryDatabase();
  runtime = runtimeFor(database);
});

afterEach(async () => {
  await runtime.dispose();
  await rm(database.directory, { force: true, recursive: true });
});

const appOf = () =>
  createApp({
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
