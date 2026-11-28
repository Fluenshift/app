// Ported from Grifando src/server/session/currentUser.test.ts (74dbb9f) on a fresh PGlite
// database per case: ensureLearner acts for the CurrentLearner where ensureUser took a userId,
// and the rows are read and written through the Database service where the test used Prisma.
import { rm } from "node:fs/promises";

import { LearnerId, MistakeCategory } from "@grifando/contract";
import { Database, learners, mistakePatterns } from "@grifando/db";
import type { DrizzleClient } from "@grifando/db";
import { eq } from "drizzle-orm";
import { Effect, Schema } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { listPatterns } from "../academy/mistake-pattern-repository";
import { CurrentLearner } from "../learner-identity";
import { makeTemporaryDatabase } from "../test/database";
import { ensureLearner } from "./ensure-learner";

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

const ensureLearnerFor = (learner: string) => as(learner, ensureLearner());

const query = <A>(run: (client: DrizzleClient) => Promise<A>) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const store = yield* Database;
      return yield* store.run(run);
    }).pipe(Effect.provide(database.layer))
  );

const lastActiveAtOf = (learner: string) =>
  query((client) =>
    client
      .select({ lastActiveAt: learners.lastActiveAt })
      .from(learners)
      .where(eq(learners.id, learner))
  ).then(([row]) => {
    if (row === undefined) {
      throw new Error(`No Learner ${learner}`);
    }
    return row.lastActiveAt;
  });

const setLastActiveAt = (learner: string, lastActiveAt: Date) =>
  query((client) =>
    client
      .update(learners)
      .set({ lastActiveAt })
      .where(eq(learners.id, learner))
  );

describe("ensureUser", () => {
  it("creates the user on first write and isolates two sessions", async () => {
    await ensureLearnerFor("s1");
    await ensureLearnerFor("s2");
    await query((client) =>
      client.insert(mistakePatterns).values({
        category: MistakeCategory.PREPOSITIONS,
        exampleCorrection: "I depend on this library.",
        exampleOriginal: "I depend of this library.",
        id: "pattern-1",
        learnerId: "s1",
        patternKey: "depend-on",
      })
    );
    expect(await as("s2", listPatterns())).toEqual([]);
    expect(await as("s1", listPatterns())).toHaveLength(1);
  });

  it("recreates a deleted user on the next write", async () => {
    await ensureLearnerFor("s1");
    await query((client) =>
      client.delete(learners).where(eq(learners.id, "s1"))
    );
    await ensureLearnerFor("s1");
    expect(
      await query((client) => client.$count(learners, eq(learners.id, "s1")))
    ).toBe(1);
  });

  it("bumps lastActiveAt at most once per hour", async () => {
    await ensureLearnerFor("s1");

    const recent = new Date(Date.now() - 30 * 60 * 1000);
    await setLastActiveAt("s1", recent);
    await ensureLearnerFor("s1");
    const unchanged = await lastActiveAtOf("s1");
    expect(unchanged.getTime()).toBe(recent.getTime());

    const stale = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await setLastActiveAt("s1", stale);
    await ensureLearnerFor("s1");
    const bumped = await lastActiveAtOf("s1");
    expect(bumped.getTime()).toBeGreaterThan(stale.getTime());
  });
});
