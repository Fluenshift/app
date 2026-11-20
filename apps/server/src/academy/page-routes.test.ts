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
  vocabularyItems,
} from "@fluenshift/db";
import type { DrizzleClient } from "@fluenshift/db";
import { Effect, Layer, ManagedRuntime, Option } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app";
import type { AppBoundaries } from "../app";
import { LearnerIdentity } from "../learner-identity";
import { makeTemporaryDatabase } from "../test/database";
import { dailyChallenge } from "./daily-challenge";
import { listVocabularyItems } from "./vocabulary-repository";

const NOW = new Date("2026-03-05T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY);

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
    listVocabularyItems,
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

const seedVocabularyItem = (
  learnerId: string,
  values: Pick<
    typeof vocabularyItems.$inferInsert,
    "createdAt" | "exampleSentence" | "meaningPt" | "term"
  >
) =>
  query(async (client) => {
    await client
      .insert(learners)
      .values({ id: learnerId })
      .onConflictDoNothing();
    const id = randomUUID();
    await client.insert(vocabularyItems).values({ id, learnerId, ...values });
    return id;
  });

// The prefill half of this row is the screen test's: the form takes it from the history state
// (docs/adr/0025). The route answers the list the page shows.
describe("/vocabulary", () => {
  it("lists the visitor's items newest first and prefills the form from the history state", async () => {
    const empty = await GET("/api/vocabulary");
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({ items: [] });

    const older = await seedVocabularyItem("visitor-1", {
      createdAt: daysAgo(2),
      exampleSentence: "I rely on tests.",
      meaningPt: "depender de",
      term: "rely on",
    });
    const newer = await seedVocabularyItem("visitor-1", {
      createdAt: daysAgo(1),
      exampleSentence: "We roll out on Fridays.",
      meaningPt: "implantar",
      term: "roll out",
    });
    await seedVocabularyItem("other-user", {
      createdAt: NOW,
      exampleSentence: "Not yours.",
      meaningPt: "de outra pessoa",
      term: "someone else's",
    });

    const listed = await GET("/api/vocabulary");
    expect(listed.status).toBe(200);
    expect(await listed.json()).toEqual({
      items: [
        {
          createdAt: daysAgo(1).toISOString(),
          exampleSentence: "We roll out on Fridays.",
          id: newer,
          meaningPt: "implantar",
          sourceEvaluationId: null,
          term: "roll out",
        },
        {
          createdAt: daysAgo(2).toISOString(),
          exampleSentence: "I rely on tests.",
          id: older,
          meaningPt: "depender de",
          sourceEvaluationId: null,
          term: "rely on",
        },
      ],
    });
  });
});

describe("GET /api/vocabulary", () => {
  it("answers the generic 500 when the database fails", async () => {
    const response = await appOf({
      listVocabularyItems: () =>
        Effect.fail(new DatabaseError({ cause: new Error("down") })),
    }).request(new Request("http://localhost/api/vocabulary"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Something went wrong. Please try again.",
    });
  });
});
