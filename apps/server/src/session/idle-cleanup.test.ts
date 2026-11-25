// Ported from Grifando src/server/domain/privacy/cleanup.test.ts (74dbb9f), the cleanupIdleData
// cases and the bounds its characterization pins, on a fresh PGlite database per case: an
// Evaluation, which replaces Grifando's writing session (docs/adr/0004), is a Learner's data, and
// the counts name Learners, not users. With the daily schedule that replaces Grifando's cron route
// (docs/adr/0011), on Effect's TestClock.
import { rm } from "node:fs/promises";

import { LearnerId } from "@grifando/contract";
import {
  Database,
  evaluations,
  learners,
  rateLimitWindows,
} from "@grifando/db";
import type { DrizzleClient } from "@grifando/db";
import { eq } from "drizzle-orm";
import { Effect, Fiber, Layer, Logger, Schema } from "effect";
import { TestClock } from "effect/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { persistEvaluation } from "../history/learning-history";
import { CurrentLearner } from "../learner-identity";
import { makeTemporaryDatabase } from "../test/database";
import { cleanupIdleData, daily } from "./idle-cleanup";

let database: Awaited<ReturnType<typeof makeTemporaryDatabase>>;

// A failed run whose message stands for a Learner's text, which no log line may carry.
class CleanupFailedError extends Schema.TaggedError<
  CleanupFailedError,
  { readonly brand: unique symbol }
>()("CleanupFailedError", { message: Schema.String }) {}

beforeEach(async () => {
  database = await makeTemporaryDatabase();
});

afterEach(async () => {
  await rm(database.directory, { force: true, recursive: true });
});

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-07T12:00:00Z");

const run = <A, E>(effect: Effect.Effect<A, E, Database>) =>
  Effect.runPromise(effect.pipe(Effect.provide(database.layer)));

const query = <A>(read: (client: DrizzleClient) => Promise<A>) =>
  run(
    Effect.gen(function* () {
      const store = yield* Database;
      return yield* store.run(read);
    })
  );

// A Learner last active `idleDays` before `now`, with one Evaluation, as Grifando's seedUser gave
// each user one writing session.
const seedLearner = async (id: string, idleDays: number) => {
  await query((client) =>
    client
      .insert(learners)
      .values({ id, lastActiveAt: new Date(now.getTime() - idleDays * DAY) })
  );
  await Effect.runPromise(
    persistEvaluation({
      contentHash: `hash-${id}`,
      evaluation: {
        band: "Natural",
        correctedText: "hello",
        evaluatedAt: "2026-11-01T12:00:00.000Z",
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
      submittedAt: "2026-11-01T11:59:59.000Z",
    }).pipe(
      Effect.provideService(
        CurrentLearner,
        CurrentLearner.of({ id: Schema.decodeSync(LearnerId)(id) })
      ),
      Effect.provide(database.layer)
    )
  );
};

// The Learner's row, or null once it is gone, as Prisma's findUnique answered.
const findLearner = (id: string) =>
  query((client) =>
    client.select().from(learners).where(eq(learners.id, id))
  ).then(([row]) => row ?? null);

const evaluationCount = (id: string) =>
  query((client) => client.$count(evaluations, eq(evaluations.learnerId, id)));

describe("cleanupIdleData", () => {
  it("removes users idle 91 days with their data, keeps 89-day ones", async () => {
    await seedLearner("old", 91);
    await seedLearner("recent", 89);
    const result = await run(cleanupIdleData(now));
    expect(result.learners).toBe(1);
    expect(await findLearner("old")).toBeNull();
    expect(await evaluationCount("old")).toBe(0);
    expect(await findLearner("recent")).not.toBeNull();
    expect(await evaluationCount("recent")).toBe(1);
  });

  it("removes rate-limit windows older than 2 days only", async () => {
    await query((client) =>
      client.insert(rateLimitWindows).values([
        { count: 1, key: "a", windowStart: new Date(now.getTime() - 3 * DAY) },
        { count: 1, key: "b", windowStart: new Date(now.getTime() - 1 * DAY) },
      ])
    );
    const result = await run(cleanupIdleData(now));
    expect(result.windows).toBe(1);
    const remaining = await query((client) =>
      client.select().from(rateLimitWindows)
    );
    expect(remaining.map((w) => w.key)).toEqual(["b"]);
  });
});

describe("cleanupIdleData bounds", () => {
  it("keeps a user idle exactly 90 days and a rate-limit window exactly 2 days old", async () => {
    await query((client) =>
      client.insert(learners).values({
        id: "edge",
        lastActiveAt: new Date(now.getTime() - 90 * DAY),
      })
    );
    await query((client) =>
      client.insert(rateLimitWindows).values({
        count: 1,
        key: "edge",
        windowStart: new Date(now.getTime() - 2 * DAY),
      })
    );
    expect(await run(cleanupIdleData(now))).toEqual({
      learners: 0,
      windows: 0,
    });
  });
});

describe("daily cleanup", () => {
  it("runs at 03:17 UTC every day, as Grifando's cron did", async () => {
    const runs: number[] = [];
    const counted = await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(
          daily(
            Effect.sync(() => {
              runs.push(runs.length);
            })
          )
        );
        // TestClock starts at 1970-01-01T00:00:00Z.
        yield* TestClock.adjust("196 minutes");
        const beforeTheHour = runs.length;
        yield* TestClock.adjust("1 minute");
        const atTheHour = runs.length;
        yield* TestClock.adjust("1 day");
        const nextDay = runs.length;
        yield* Fiber.interrupt(fiber);
        return { atTheHour, beforeTheHour, nextDay };
      }).pipe(Effect.provide(TestClock.layer()))
    );
    expect(counted).toEqual({ atTheHour: 1, beforeTheHour: 0, nextDay: 2 });
  });

  it("logs a failed run by its name and keeps the schedule", async () => {
    const logged: unknown[] = [];
    const keepLogs = Logger.layer([
      Logger.make((options) => {
        logged.push(Logger.formatStructured.log(options));
      }),
    ]);
    let attempts = 0;
    await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(
          daily(
            Effect.suspend(() => {
              attempts += 1;
              return attempts === 1
                ? Effect.fail(
                    new CleanupFailedError({ message: "Learner private text" })
                  )
                : Effect.void;
            })
          )
        );
        yield* TestClock.adjust("2 days");
        yield* Fiber.interrupt(fiber);
      }).pipe(Effect.provide(Layer.mergeAll(TestClock.layer(), keepLogs)))
    );
    expect(attempts).toBe(2);
    expect(JSON.stringify(logged)).toContain("idle-cleanup failed");
    expect(JSON.stringify(logged)).toContain("CleanupFailedError");
    expect(JSON.stringify(logged)).not.toContain("Learner private text");
  });
});
