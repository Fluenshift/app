// Ported from Grifando's characterization of GET /api/exercises (74dbb9f,
// migration/characterization/grifando/files/src/app/api/exercises): the visitor's exercises
// without an attempt, by their public view only. The route runs on a fresh PGlite database, and
// a test header names the Learner, as a session would.
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";

import type { LearnerId } from "@fluenshift/contract";
import {
  Database,
  exerciseAttempts,
  exercises,
  learners,
  mistakePatterns,
} from "@fluenshift/db";
import type { DrizzleClient } from "@fluenshift/db";
import { Effect, Layer, ManagedRuntime, Option } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../app";
import { LearnerIdentity } from "../learner-identity";
import { makeTemporaryDatabase } from "../test/database";
import { listPendingExercises } from "./exercise-repository";

const learnerFromHeader = Layer.succeed(
  LearnerIdentity,
  LearnerIdentity.of({
    identify: (request) =>
      Effect.succeed(
        (request.headers.get("x-test-learner") ?? "visitor-1") as LearnerId
      ),
  })
);

const runtimeFor = (
  temporary: Awaited<ReturnType<typeof makeTemporaryDatabase>>
) => ManagedRuntime.make(Layer.mergeAll(temporary.layer, learnerFromHeader));

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
    limits: {
      bodyMaxBytes: 256 * 1024,
      codeMaxCharacters: Option.none(),
      promptMaxCharacters: Option.none(),
      sampleMaxBytes: 32 * 1024,
      sampleMaxCharacters: Option.none(),
    },
    listPendingExercises,
    profile: "local",
    runtime,
    serveWeb: false,
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

const seedPattern = (learnerId: string) =>
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
