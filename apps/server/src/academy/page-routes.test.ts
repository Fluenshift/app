// Ported from Grifando's characterization of the pages that read repositories in Server
// Components (74dbb9f, migration/characterization/grifando/files/src/app/
// pages.characterization.test.ts). Under docs/adr/0025 each page read is a Hono route: these cases
// check the data a route answers, and the screen tests of apps/web what the page renders from it.
// The routes run on a fresh PGlite database, a test header names the Learner, as a session would,
// and the clock is fixed, because the daily prompt reads it.
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";

import type { LearnerId } from "@fluenshift/contract";
import {
  Database,
  DatabaseError,
  learners,
  mistakePatterns,
} from "@fluenshift/db";
import type { DrizzleClient } from "@fluenshift/db";
import { Effect, Layer, ManagedRuntime, Option } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app";
import type { AppBoundaries } from "../app";
import { LearnerIdentity } from "../learner-identity";
import { makeTemporaryDatabase } from "../test/database";
import { dailyChallenge } from "./daily-challenge";

const NOW = new Date("2026-03-05T12:00:00Z");

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
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
});

afterEach(async () => {
  vi.useRealTimers();
  await runtime.dispose();
  await rm(database.directory, { force: true, recursive: true });
});

const appOf = (boundaries: AppBoundaries = {}) =>
  createApp({
    getDailyChallenge: dailyChallenge,
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
    ...boundaries,
  });

const GET = (url: string, learner?: string) =>
  appOf().request(
    new Request(`http://localhost${url}`, {
      headers: learner === undefined ? {} : { "x-test-learner": learner },
    })
  );

const query = <A>(read: (client: DrizzleClient) => Promise<A>) =>
  runtime.runPromise(
    Effect.gen(function* () {
      const service = yield* Database;
      return yield* service.run(read);
    })
  );

const seedPattern = (
  learnerId: string,
  values: Pick<
    typeof mistakePatterns.$inferInsert,
    | "category"
    | "lastPracticedAt"
    | "lastSeenAt"
    | "occurrenceCount"
    | "patternKey"
  >
) =>
  query(async (client) => {
    await client
      .insert(learners)
      .values({ id: learnerId })
      .onConflictDoNothing();
    await client.insert(mistakePatterns).values({
      exampleCorrection: `${values.patternKey} correction`,
      exampleOriginal: `${values.patternKey} original`,
      id: randomUUID(),
      learnerId,
      ...values,
    });
  });

describe("/today", () => {
  it("hands TodaySession today's challenge, biased toward the visitor's active categories", async () => {
    const plain = await GET("/api/daily-challenge");
    expect(plain.status).toBe(200);
    expect(await plain.json()).toEqual({
      promptText:
        "Explain what an API is to someone with no programming background.",
      promptType: "DAILY_CHALLENGE",
    });

    await seedPattern("other-user", {
      category: "PREPOSITIONS",
      lastPracticedAt: NOW,
      lastSeenAt: NOW,
      occurrenceCount: 1,
      patternKey: "depend-on",
    });
    const unbiased = await GET("/api/daily-challenge");
    expect(await unbiased.json()).toEqual({
      promptText:
        "Explain what an API is to someone with no programming background.",
      promptType: "DAILY_CHALLENGE",
    });

    await seedPattern("visitor-1", {
      category: "PREPOSITIONS",
      lastPracticedAt: NOW,
      lastSeenAt: NOW,
      occurrenceCount: 1,
      patternKey: "depend-on",
    });
    const biased = await GET("/api/daily-challenge");
    expect(await biased.json()).toEqual({
      promptText:
        "Describe a bug you recently solved and how you found the root cause.",
      promptType: "DAILY_CHALLENGE",
    });
  });
});

describe("GET /api/daily-challenge", () => {
  it("answers the generic 500 when the database fails", async () => {
    const response = await appOf({
      getDailyChallenge: () =>
        Effect.fail(new DatabaseError({ cause: new Error("down") })),
    }).request(new Request("http://localhost/api/daily-challenge"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Something went wrong. Please try again.",
    });
  });
});
