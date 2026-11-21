// Ported from Grifando src/server/domain/privacy/cleanup.test.ts (74dbb9f), the deleteUserData case,
// on a fresh PGlite database: deleteLearner acts for the CurrentLearner where deleteUserData took a
// userId, and an Evaluation, which replaces Grifando's writing session (docs/adr/0004), is the
// Learner's data.
import { rm } from "node:fs/promises";

import { LearnerId } from "@fluenshift/contract";
import { Database, evaluations, learners } from "@fluenshift/db";
import type { DrizzleClient } from "@fluenshift/db";
import { eq } from "drizzle-orm";
import { Effect, Schema } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { persistEvaluation } from "../history/learning-history";
import { CurrentLearner } from "../learner-identity";
import { makeTemporaryDatabase } from "../test/database";
import { deleteLearner } from "./delete-learner";

let database: Awaited<ReturnType<typeof makeTemporaryDatabase>>;

beforeEach(async () => {
  database = await makeTemporaryDatabase();
});

afterEach(async () => {
  await rm(database.directory, { force: true, recursive: true });
});

// Runs an Effect for the Learner of one session.
const as = <A, E>(
  learner: string,
  effect: Effect.Effect<A, E, CurrentLearner | Database>
) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provideService(
        CurrentLearner,
        CurrentLearner.of({ id: Schema.decodeSync(LearnerId)(learner) })
      ),
      Effect.provide(database.layer)
    )
  );

const query = <A>(run: (client: DrizzleClient) => Promise<A>) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const store = yield* Database;
      return yield* store.run(run);
    }).pipe(Effect.provide(database.layer))
  );

// A Learner with one Evaluation, as Grifando's seedUser gave each user one writing session.
const seedLearner = (id: string) =>
  as(
    id,
    persistEvaluation({
      contentHash: `hash-${id}`,
      evaluation: {
        band: "Natural",
        correctedText: "hello",
        evaluatedAt: "2026-11-07T12:00:00.000Z",
        evaluatedEnglishWordCount: 1,
        findings: [],
        id: `evaluation-${id}`,
        model: "deterministic-test-model",
        originalText: "hello",
        provider: "test",
        rubricVersion: "1",
        score: 100,
        suggestions: [],
        summary: "No errors found.",
      },
      latencyMilliseconds: 20,
      submittedAt: "2026-11-07T11:59:59.000Z",
    })
  );

// The Learner's row, or null once it is gone, as Prisma's findUnique answered.
const findLearner = (id: string) =>
  query((client) =>
    client.select().from(learners).where(eq(learners.id, id))
  ).then(([row]) => row ?? null);

const evaluationCount = (id: string) =>
  query((client) => client.$count(evaluations, eq(evaluations.learnerId, id)));

describe("deleteUserData", () => {
  it("deletes the user and their data but not others", async () => {
    await seedLearner("me");
    await seedLearner("other");
    await as("me", deleteLearner());
    expect(await findLearner("me")).toBeNull();
    expect(await evaluationCount("me")).toBe(0);
    expect(await evaluationCount("other")).toBe(1);
  });
});
