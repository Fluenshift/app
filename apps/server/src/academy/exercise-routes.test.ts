// Ported from Grifando's characterization of GET /api/exercises (74dbb9f,
// migration/characterization/grifando/files/src/app/api/exercises): the visitor's exercises
// without an attempt, by their public view only. The route runs on a fresh PGlite database, and
// a test header names the Learner, as a session would.
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";

import { AIResponseValidationError } from "@grifando/contract";
import type { GeneratedExercise, LearnerId } from "@grifando/contract";
import {
  Database,
  exerciseAttempts,
  exercises,
  learners,
  mistakePatterns,
  occurrences,
} from "@grifando/db";
import type { DrizzleClient } from "@grifando/db";
import { TrainerConfig } from "@grifando/env";
import { ConfigProvider, Effect, Layer, ManagedRuntime, Option } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app";
import { persistEvaluation } from "../history/learning-history";
import { CurrentLearner, LearnerIdentity } from "../learner-identity";
import { makeTemporaryDatabase } from "../test/database";
import { explainAttemptFor, generateExercisesFor } from "./academy-requests";
import { listPendingExercises } from "./exercise-repository";
import { submitAttempt } from "./exercise-service";
import { listPatternIdsForEvaluation } from "./mistake-pattern-repository";
import type { ExerciseTarget } from "./prompts/exercise-generation";
import { TrainerClient } from "./trainer/trainer-client";
import {
  TrainerKeyRejectedError,
  TrainerQuotaExceededError,
} from "./trainer/trainer-errors";
import type { TrainerError } from "./trainer/trainer-errors";
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

// The Trainer of every request; a case swaps it before it posts.
let trainer: TrainerMethods;

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

const generating = (...generated: readonly GeneratedExercise[]) =>
  vi.fn((_targets: readonly ExerciseTarget[]) =>
    Effect.succeed({ exercises: generated, model: "test-model" })
  );

beforeEach(async () => {
  database = await makeTemporaryDatabase();
  runtime = runtimeFor(database);
  trainer = {
    continueInterview: vi.fn<TrainerMethods["continueInterview"]>(),
    enrichFindings: vi.fn<TrainerMethods["enrichFindings"]>(),
    explainAttempt: vi.fn<TrainerMethods["explainAttempt"]>(() =>
      Effect.succeed({
        explanation: "'Depend' takes 'on'.",
        model: "test-model",
      })
    ),
    generateExercises: generating(multipleChoice()),
  };
});

afterEach(async () => {
  await runtime.dispose();
  await rm(database.directory, { force: true, recursive: true });
});

const appOf = () =>
  createApp({
    explainAttempt: explainAttemptFor,
    generateExercises: generateExercisesFor,
    limits: {
      bodyMaxBytes: 256 * 1024,
      codeMaxCharacters: Option.none(),
      sampleMaxBytes: 32 * 1024,
      sampleMaxCharacters: Option.none(),
    },
    listPendingExercises,
    profile: "local",
    runtime,
    serveWeb: false,
    submitAttempt,
    webDistPath: "unused",
  });

const query = <A>(read: (client: DrizzleClient) => Promise<A>) =>
  runtime.runPromise(
    Effect.gen(function* () {
      const service = yield* Database;
      return yield* service.run(read);
    })
  );

const GET = () =>
  appOf().request(new Request("http://localhost/api/exercises"));

const multipleChoice = () => ({
  correctOptionIndex: 1,
  explanation: "Use 'depend on', not 'depend of'.",
  instruction: "Choose the correct sentence.",
  options: ["I depend of this library.", "I depend on this library."],
  type: "MULTIPLE_CHOICE" as const,
});

const seedPattern = (
  learnerId: string,
  overrides: Partial<typeof mistakePatterns.$inferInsert> = {}
) =>
  query(async (client) => {
    await client
      .insert(learners)
      .values({ id: learnerId })
      .onConflictDoNothing();
    const [pattern] = await client
      .insert(mistakePatterns)
      .values({
        category: "PREPOSITIONS",
        exampleCorrection: "I depend on this library.",
        exampleOriginal: "I depend of this library.",
        id: randomUUID(),
        learnerId,
        occurrenceCount: 3,
        patternKey: "depend-on",
        ...overrides,
      })
      .returning();
    if (pattern === undefined) {
      throw new Error("Expected the pattern");
    }
    return pattern;
  });

const seedExercise = (learnerId: string, sourcePatternId: string) =>
  query(async (client) => {
    const [exercise] = await client
      .insert(exercises)
      .values({
        id: randomUUID(),
        learnerId,
        model: "test-model",
        promptData: multipleChoice(),
        sourcePatternId,
        type: "MULTIPLE_CHOICE",
      })
      .returning();
    if (exercise === undefined) {
      throw new Error("Expected the exercise");
    }
    return exercise;
  });

describe("GET /api/exercises", () => {
  it("lists the visitor's pending exercises by their public view only", async () => {
    const empty = await GET();
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({ exercises: [] });

    const pattern = await seedPattern("visitor-1");
    await seedExercise("visitor-1", pattern.id);
    const other = await seedPattern("other-user");
    await seedExercise("other-user", other.id);

    const listed = await GET();
    expect(listed.status).toBe(200);
    expect(await listed.json()).toEqual({
      exercises: [
        {
          id: expect.any(String),
          prompt: {
            instruction: "Choose the correct sentence.",
            options: ["I depend of this library.", "I depend on this library."],
            type: "MULTIPLE_CHOICE",
          },
          type: "MULTIPLE_CHOICE",
        },
      ],
    });
  });
});

describe("GET /api/exercises pending", () => {
  it("drops an exercise once it has an attempt", async () => {
    const pattern = await seedPattern("visitor-1");
    const exercise = await seedExercise("visitor-1", pattern.id);
    await query((client) =>
      client.insert(exerciseAttempts).values({
        exerciseId: exercise.id,
        feedback: "Correct.",
        id: randomUUID(),
        isCorrect: true,
        learnerAnswer: "1",
        learnerId: "visitor-1",
      })
    );

    const response = await GET();
    expect(await response.json()).toEqual({ exercises: [] });
  });
});

const AI_HEADERS = { "x-ai-key": "test-key", "x-ai-provider": "gemini" };

const post = (body: unknown, headers: Record<string, string> = AI_HEADERS) =>
  appOf().request(
    new Request("http://localhost/api/exercises", {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json", ...headers },
      method: "POST",
    })
  );

// Ported from Grifando's characterization of POST /api/exercises and from its route.test.ts
// (74dbb9f). The daily session's afterSessionId is afterEvaluationId under docs/adr/0004, and a
// typed error reaches the route from a real practice set, so that case seeds a pattern first.
describe("POST /api/exercises", () => {
  it("answers 400 with the validation issues for a malformed body", async () => {
    const response = await post({ afterEvaluationId: "" });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "Invalid request body",
      issues: [expect.any(Object)],
    });
  });

  it("answers 422 before the first mistake pattern exists", async () => {
    const response = await post({});
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error:
        "No mistake patterns yet \u2014 write something first to get personalized exercises.",
    });
  });

  it("answers 201 with the new exercises by their public view", async () => {
    await seedPattern("visitor-1");
    const response = await post({});
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      exercises: [
        {
          id: expect.any(String),
          prompt: {
            instruction: "Choose the correct sentence.",
            options: ["I depend of this library.", "I depend on this library."],
            type: "MULTIPLE_CHOICE",
          },
          type: "MULTIPLE_CHOICE",
        },
      ],
    });
  });

  // Grifando's route read a body that is not JSON as no body (src/app/api/exercises/route.ts,
  // 74dbb9f).
  it("reads a body that is not JSON as no body", async () => {
    await seedPattern("visitor-1");
    const response = await appOf().request(
      new Request("http://localhost/api/exercises", {
        body: "{",
        headers: { "content-type": "application/json", ...AI_HEADERS },
        method: "POST",
      })
    );
    expect(response.status).toBe(201);
  });

  it("answers 500 with a generic message when generation fails unexpectedly", async () => {
    await seedPattern("visitor-1");
    trainer = {
      ...trainer,
      generateExercises: () => Effect.die(new Error("private cause")),
    };
    const response = await post({});
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Something went wrong. Please try again.",
    });
  });

  it("answers 401 AI_KEY_REQUIRED without credentials", async () => {
    const res = await post({}, {});
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "AI_KEY_REQUIRED" });
  });

  it("maps a typed AI error from generation to its coded response", async () => {
    await seedPattern("visitor-1");
    trainer = {
      ...trainer,
      generateExercises: () => Effect.fail(new TrainerKeyRejectedError()),
    };
    const res = await post({});
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "AI_KEY_REJECTED" });
  });
});

// A practice Evaluation of the visitor with one Finding, and an Occurrence of `patternId` from it.
const seedOccurrence = async (patternId: string) => {
  const evaluationId = randomUUID();
  await runtime.runPromise(
    persistEvaluation({
      contentHash: "hash",
      evaluation: {
        band: "Clear",
        correctedText: "I worked on a payments API.",
        evaluatedAt: "2026-11-17T12:00:00.000Z",
        evaluatedEnglishWordCount: 5,
        findings: [
          {
            byteEnd: 7,
            byteStart: 2,
            category: "Verb form/tense",
            correction: "worked",
            explanation: "Use the past tense.",
            originalText: "work ",
            severity: "Minor",
          },
        ],
        id: evaluationId,
        model: "judge-model",
        originalText: "I work in a payments API.",
        provider: "test",
        rubricVersion: "1-provisional",
        score: 80,
        suggestions: [],
        summary: "One tense mistake.",
      },
      latencyMilliseconds: 1,
      origin: "practice",
      submittedAt: "2026-11-17T12:00:00.000Z",
    }).pipe(
      Effect.provideService(
        CurrentLearner,
        CurrentLearner.of({ id: "visitor-1" as LearnerId })
      )
    )
  );
  await query((client) =>
    client.insert(occurrences).values({
      category: "PREPOSITIONS",
      correctedSpan: "worked on",
      evaluationId,
      example: "I worked on a payments API.",
      explanation: "Use the past tense.",
      findingPosition: 0,
      id: randomUUID(),
      learnerId: "visitor-1",
      originalSpan: "work in",
      patternId,
      rubricVersion: "1-provisional",
      severity: "ERROR",
    })
  );
  return evaluationId;
};

// Grifando's daily session (exerciseService.ts, 74dbb9f), which no Grifando test covers: after
// a piece of writing, the patterns that writing produced open the set.
describe("POST /api/exercises daily session", () => {
  it("opens the set with the patterns of the Evaluation it follows", async () => {
    const generateExercises = generating(multipleChoice());
    trainer = { ...trainer, generateExercises };
    const longAgo = new Date("2026-01-01T00:00:00.000Z");
    await seedPattern("visitor-1", {
      lastPracticedAt: longAgo,
      lastSeenAt: longAgo,
    });
    const fresh = await seedPattern("visitor-1", {
      exampleCorrection: "I worked on a payments API.",
      exampleOriginal: "I work in a payments API.",
      lastPracticedAt: new Date(),
      patternKey: "work-on",
    });
    const evaluationId = await seedOccurrence(fresh.id);

    await post({});
    await post({ afterEvaluationId: evaluationId });

    const firstOf = (call: number) =>
      generateExercises.mock.calls[call]?.[0][0]?.exampleOriginal;
    expect(firstOf(0)).toBe("I depend of this library.");
    expect(firstOf(1)).toBe("I work in a payments API.");
  });

  it("takes only the patterns of that Evaluation as fresh", async () => {
    const first = await seedPattern("visitor-1", { patternKey: "first" });
    const second = await seedPattern("visitor-1", { patternKey: "second" });
    const evaluationId = await seedOccurrence(first.id);
    await seedOccurrence(second.id);

    expect(
      await runtime.runPromise(
        listPatternIdsForEvaluation(evaluationId).pipe(
          Effect.provideService(
            CurrentLearner,
            CurrentLearner.of({ id: "visitor-1" as LearnerId })
          )
        )
      )
    ).toEqual([first.id]);
  });
});

// Ported from Grifando's characterization of the attempt routes (74dbb9f,
// migration/characterization/grifando/files/src/app/api/exercises/[id]/attempts): grading an
// Attempt needs no key, and its explanation never changes the grade. Grifando's provider mock is
// the fake Trainer, which fails with a typed error or dies for an unknown one.
const postAttempt = (exerciseId: string, body: unknown) =>
  appOf().request(
    new Request(`http://localhost/api/exercises/${exerciseId}/attempts`, {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "POST",
    })
  );

const postExplanation = (
  ids: { readonly attemptId: string; readonly exerciseId: string },
  headers: Record<string, string> = {}
) =>
  appOf().request(
    new Request(
      `http://localhost/api/exercises/${ids.exerciseId}/attempts/${ids.attemptId}/explanation`,
      {
        headers: { "content-type": "application/json", ...headers },
        method: "POST",
      }
    )
  );

// Grifando's seedExercise: a Mistake Pattern of the Learner and an Exercise from it.
const seedExerciseWithPattern = async (learnerId: string) => {
  const pattern = await seedPattern(learnerId);
  return seedExercise(learnerId, pattern.id);
};

// A wrong answer of the visitor to a new Exercise, graded through the route.
const seedAttempt = async () => {
  const exercise = await seedExerciseWithPattern("visitor-1");
  const graded = await postAttempt(exercise.id, { answer: "0" });
  const { attemptId } = (await graded.json()) as { attemptId: string };
  return { attemptId, exerciseId: exercise.id };
};

describe("POST /api/exercises/[id]/attempts", () => {
  it("grades an answer and returns the attempt with the whole exercise", async () => {
    const exercise = await seedExerciseWithPattern("visitor-1");
    const response = await postAttempt(exercise.id, { answer: "1" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      attemptId: expect.any(String),
      exercise: multipleChoice(),
      explanation: "Use 'depend on', not 'depend of'.",
      isCorrect: true,
    });
  });

  it("answers 400 with the validation issues for an empty answer", async () => {
    const exercise = await seedExerciseWithPattern("visitor-1");
    const response = await postAttempt(exercise.id, { answer: "  " });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "Invalid request body",
      issues: [expect.any(Object)],
    });
  });

  // Grifando's route read a body that is not JSON as null (src/app/api/exercises/[id]/attempts,
  // 74dbb9f).
  it("refuses a body that is not JSON with the issue of a null body", async () => {
    const exercise = await seedExerciseWithPattern("visitor-1");
    const response = await appOf().request(
      new Request(`http://localhost/api/exercises/${exercise.id}/attempts`, {
        body: "{",
        headers: { "content-type": "application/json" },
        method: "POST",
      })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid request body",
      issues: [{ message: "Expected object", path: [] }],
    });
  });

  it("answers 404 for an unknown exercise and for another user's", async () => {
    const other = await seedExerciseWithPattern("other-user");
    const unknown = await postAttempt("missing", { answer: "1" });
    const foreign = await postAttempt(other.id, { answer: "1" });
    expect([unknown.status, foreign.status]).toEqual([404, 404]);
    expect(await foreign.json()).toEqual({ error: "Not found" });
  });
});

describe("POST /api/exercises/[id]/attempts/[attemptId]/explanation", () => {
  it("explains an attempt with the provider's text", async () => {
    const ids = await seedAttempt();
    const response = await postExplanation(ids, AI_HEADERS);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      explanation: "'Depend' takes 'on'.",
    });
  });

  it("answers 401 AI_KEY_REQUIRED without a key and 404 for an unknown attempt", async () => {
    const ids = await seedAttempt();
    const withoutKey = await postExplanation(ids);
    const unknown = await postExplanation(
      { ...ids, attemptId: "missing" },
      AI_HEADERS
    );
    expect(withoutKey.status).toBe(401);
    expect(await withoutKey.json()).toMatchObject({ code: "AI_KEY_REQUIRED" });
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: "Not found" });
  });

  it("keeps the grade and answers 502, 500 or the AI code when the explanation fails", async () => {
    const ids = await seedAttempt();
    const explainWith = async (failure: Effect.Effect<never, TrainerError>) => {
      trainer = { ...trainer, explainAttempt: () => failure };
      const response = await postExplanation(ids, AI_HEADERS);
      return { body: await response.json(), status: response.status };
    };
    const failed =
      "We couldn't explain this answer right now. Your grade is unaffected \u2014 try again.";

    expect(
      await explainWith(
        Effect.fail(
          new AIResponseValidationError({ issues: [], message: "bad shape" })
        )
      )
    ).toEqual({ body: { error: failed }, status: 502 });
    expect(await explainWith(Effect.die(new Error("private cause")))).toEqual({
      body: { error: failed },
      status: 500,
    });
    expect(
      await explainWith(Effect.fail(new TrainerQuotaExceededError()))
    ).toMatchObject({ body: { code: "AI_QUOTA_EXCEEDED" }, status: 429 });
  });
});
