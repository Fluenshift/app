// Ported from Grifando's characterization of the pages that read repositories in Server
// Components (74dbb9f, migration/characterization/grifando/files/src/app/
// pages.characterization.test.ts). Under docs/adr/0025 each page read is a Hono route: these cases
// check the data a route answers, and the screen tests of apps/web what the page renders from it.
// The routes run on a fresh PGlite database, a test header names the Learner, as a session would,
// and the clock is fixed, because the daily prompt reads it.
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";

import type { LearnerId, MistakeCategory } from "@grifando/contract";
import {
  Database,
  DatabaseError,
  exerciseAttempts,
  exercises,
  learners,
  mistakePatterns,
  occurrences,
} from "@grifando/db";
import type { DrizzleClient } from "@grifando/db";
import { Effect, Layer, ManagedRuntime, Option } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../app";
import type { AppBoundaries } from "../app";
import { persistEvaluation } from "../history/learning-history";
import { CurrentLearner, LearnerIdentity } from "../learner-identity";
import { makeTemporaryDatabase } from "../test/database";
import { academyDashboard } from "./academy-dashboard";
import { dailyChallenge } from "./daily-challenge";
import { mistakeNotebook } from "./mistake-notebook";

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
    getAcademyDashboard: academyDashboard,
    getDailyChallenge: dailyChallenge,
    getMistakeNotebook: mistakeNotebook,
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
    | "masteryLevel"
    | "occurrenceCount"
    | "patternKey"
  >
) =>
  query(async (client) => {
    await client
      .insert(learners)
      .values({ id: learnerId })
      .onConflictDoNothing();
    const id = randomUUID();
    await client.insert(mistakePatterns).values({
      exampleCorrection: `${values.patternKey} correction`,
      exampleOriginal: `${values.patternKey} original`,
      id,
      learnerId,
      ...values,
    });
    return id;
  });

interface SeededOccurrence {
  readonly category: MistakeCategory;
  readonly l1Transfer?: boolean;
  readonly patternId: string;
}

// A practice Evaluation of the Learner at `evaluatedAt`, with one Finding per Occurrence, as
// Grifando's analyzed writing session with its mistake occurrences (docs/adr/0004).
// The shape of a seeded Evaluation beyond its Occurrences: its Finding count (at least one per
// Occurrence), its evaluated English words and its Rubric Version.
interface SeededShape {
  readonly findingCount?: number;
  readonly rubricVersion?: string;
  readonly words?: number;
}

const seedEvaluation = async (
  learnerId: string,
  evaluatedAt: Date,
  seeded: readonly SeededOccurrence[] = [],
  origin: "practice" | "work" = "practice",
  shape: SeededShape = {}
) => {
  const evaluationId = randomUUID();
  await runtime.runPromise(
    persistEvaluation({
      contentHash: "hash",
      evaluation: {
        band: "Clear",
        correctedText: "Corrected.",
        evaluatedAt: evaluatedAt.toISOString(),
        evaluatedEnglishWordCount: shape.words ?? 4,
        findings: Array.from(
          { length: Math.max(shape.findingCount ?? 0, seeded.length) },
          () => ({
            byteEnd: 1,
            byteStart: 0,
            category: "Preposition" as const,
            correction: "y",
            explanation: "z",
            originalText: "x",
            severity: "Minor" as const,
          })
        ),
        id: evaluationId,
        model: "judge-model",
        originalText: `Text written ${evaluatedAt.toISOString()}.`,
        provider: "test",
        rubricVersion: shape.rubricVersion ?? "1-provisional",
        score: 80,
        suggestions: [],
        summary: "Feedback.",
      },
      latencyMilliseconds: 1,
      origin,
      submittedAt: evaluatedAt.toISOString(),
    }).pipe(
      Effect.provideService(
        CurrentLearner,
        CurrentLearner.of({ id: learnerId as LearnerId })
      )
    )
  );
  if (seeded.length > 0) {
    await query((client) =>
      client.insert(occurrences).values(
        seeded.map((occurrence, position) => ({
          category: occurrence.category,
          correctedSpan: "y",
          createdAt: evaluatedAt,
          evaluationId,
          example: "w",
          explanation: "z",
          findingPosition: position,
          id: randomUUID(),
          l1Transfer: occurrence.l1Transfer ?? false,
          learnerId,
          originalSpan: "x",
          patternId: occurrence.patternId,
          rubricVersion: "1-provisional",
          severity: "ERROR",
        }))
      )
    );
  }
  return evaluationId;
};

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

describe("/mistakes", () => {
  it("shows each pattern once with its mastery, the category breakdown and the due count", async () => {
    const empty = await GET("/api/mistakes");
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({
      breakdown: { allTime: [], last30Days: [] },
      patterns: [],
    });

    // Half-life 1 day: recall far below 0.5 after 5 days, so both patterns are due.
    const due = await seedPattern("visitor-1", {
      category: "PREPOSITIONS",
      lastPracticedAt: daysAgo(5),
      lastSeenAt: daysAgo(5),
      occurrenceCount: 2,
      patternKey: "depend-on",
    });
    const fading = await seedPattern("visitor-1", {
      category: "ARTICLES",
      lastPracticedAt: daysAgo(5),
      lastSeenAt: daysAgo(40),
      masteryLevel: "MASTERED",
      occurrenceCount: 1,
      patternKey: "a-an",
    });
    await seedEvaluation("visitor-1", daysAgo(5), [
      { category: "PREPOSITIONS", patternId: due },
      { category: "PREPOSITIONS", l1Transfer: true, patternId: due },
    ]);
    await seedEvaluation("visitor-1", daysAgo(40), [
      { category: "ARTICLES", patternId: fading },
    ]);
    const foreign = await seedPattern("other-user", {
      category: "VERB_TENSE",
      lastPracticedAt: daysAgo(5),
      lastSeenAt: daysAgo(5),
      occurrenceCount: 1,
      patternKey: "past-tense",
    });
    await seedEvaluation("other-user", daysAgo(5), [
      { category: "VERB_TENSE", l1Transfer: true, patternId: foreign },
    ]);

    const listed = await GET("/api/mistakes");
    expect(listed.status).toBe(200);
    expect(await listed.json()).toEqual({
      breakdown: {
        allTime: [
          { category: "PREPOSITIONS", count: 2, percentage: 66.7 },
          { category: "ARTICLES", count: 1, percentage: 33.3 },
        ],
        last30Days: [{ category: "PREPOSITIONS", count: 2, percentage: 100 }],
      },
      patterns: [
        {
          category: "PREPOSITIONS",
          due: true,
          exampleCorrection: "depend-on correction",
          exampleOriginal: "depend-on original",
          fading: false,
          l1Transfer: true,
          id: due,
          lastSeenAt: daysAgo(5).toISOString(),
          masteryLevel: "ACTIVE",
          occurrenceCount: 2,
        },
        {
          category: "ARTICLES",
          due: true,
          exampleCorrection: "a-an correction",
          exampleOriginal: "a-an original",
          fading: true,
          l1Transfer: false,
          id: fading,
          lastSeenAt: daysAgo(40).toISOString(),
          masteryLevel: "MASTERED",
          occurrenceCount: 1,
        },
      ],
    });
  });

  it("narrows the breakdown to 30 days and the patterns to those from Portuguese", async () => {
    const recent = await seedPattern("visitor-1", {
      category: "PREPOSITIONS",
      lastPracticedAt: NOW,
      lastSeenAt: NOW,
      occurrenceCount: 1,
      patternKey: "depend-on",
    });
    const old = await seedPattern("visitor-1", {
      category: "ARTICLES",
      lastPracticedAt: NOW,
      lastSeenAt: daysAgo(40),
      occurrenceCount: 1,
      patternKey: "a-an",
    });
    await seedEvaluation("visitor-1", daysAgo(1), [
      { category: "PREPOSITIONS", l1Transfer: true, patternId: recent },
    ]);
    await seedEvaluation("visitor-1", daysAgo(40), [
      { category: "ARTICLES", patternId: old },
    ]);

    const notebook = await GET("/api/mistakes");
    const { breakdown, patterns } = (await notebook.json()) as {
      readonly breakdown: {
        readonly allTime: readonly unknown[];
        readonly last30Days: readonly unknown[];
      };
      readonly patterns: readonly {
        readonly l1Transfer: boolean;
        readonly id: string;
      }[];
    };
    // Grifando orders the breakdown by count only, so a tie keeps no order.
    expect(breakdown.allTime).toHaveLength(2);
    expect(breakdown.allTime).toEqual(
      expect.arrayContaining([
        { category: "PREPOSITIONS", count: 1, percentage: 50 },
        { category: "ARTICLES", count: 1, percentage: 50 },
      ])
    );
    expect(breakdown.last30Days).toEqual([
      { category: "PREPOSITIONS", count: 1, percentage: 100 },
    ]);
    expect(patterns.map(({ l1Transfer, id }) => ({ l1Transfer, id }))).toEqual([
      { l1Transfer: true, id: recent },
      { l1Transfer: false, id: old },
    ]);

    await query((client) =>
      client.update(occurrences).set({ l1Transfer: false })
    );
    const unflagged = await GET("/api/mistakes");
    const after = (await unflagged.json()) as {
      readonly patterns: readonly { readonly l1Transfer: boolean }[];
    };
    expect(after.patterns.map(({ l1Transfer }) => l1Transfer)).toEqual([
      false,
      false,
    ]);
  });
});

describe("GET /api/mistakes", () => {
  it("answers the generic 500 when the database fails", async () => {
    const response = await appOf({
      getMistakeNotebook: () =>
        Effect.fail(new DatabaseError({ cause: new Error("down") })),
    }).request(new Request("http://localhost/api/mistakes"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Something went wrong. Please try again.",
    });
  });
});

// An Exercise of the Learner on `patternId`, answered once per outcome at `attemptedAt`.
const seedAttempts = (
  learnerId: string,
  patternId: string,
  attemptedAt: Date,
  outcomes: readonly boolean[]
) =>
  query(async (client) => {
    const exerciseId = randomUUID();
    await client.insert(exercises).values({
      id: exerciseId,
      learnerId,
      model: "test-model",
      promptData: {},
      sourcePatternId: patternId,
      type: "MULTIPLE_CHOICE",
    });
    await client.insert(exerciseAttempts).values(
      outcomes.map((isCorrect) => ({
        attemptedAt,
        exerciseId,
        feedback: "f",
        id: randomUUID(),
        isCorrect,
        learnerAnswer: "1",
        learnerId,
      }))
    );
  });

// Grifando's / page under docs/adr/0025: the dashboard moves to /academy. A writing session is a
// practice-origin Writing Sample (docs/adr/0004), so work-origin Evaluations count for none of it,
// the averaged model scores are gone (docs/adr/0002), and so is every game element (docs/adr/0046).
describe("/academy", () => {
  it("feeds the dashboard's progress, weak areas and recent lists", async () => {
    const empty = await GET("/api/academy/dashboard");
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({
      dailyChallenge: {
        promptText:
          "Explain what an API is to someone with no programming background.",
        promptType: "DAILY_CHALLENGE",
      },
      dueCount: 0,
      progress: {
        exerciseAccuracy: null,
        exercisesCompleted: 0,
        writingSamplesCompleted: 0,
      },
      recentPatterns: [],
      recentWriting: [],
      recommendation: null,
      findingTrend: {
        samples: [],
        window: {
          evaluatedEnglishWordCount: 0,
          evaluationCount: 0,
          findingCount: 0,
          findingRate: null,
        },
      },
      weakAreas: [],
    });

    const pattern = await seedPattern("visitor-1", {
      category: "PREPOSITIONS",
      lastPracticedAt: daysAgo(5),
      lastSeenAt: daysAgo(1),
      occurrenceCount: 3,
      patternKey: "depend-on",
    });
    const written = await Promise.all(
      [3, 2, 1, 0].map((days) =>
        seedEvaluation(
          "visitor-1",
          new Date(daysAgo(days).getTime() - 2 * 60 * 60 * 1000),
          [{ category: "PREPOSITIONS", patternId: pattern }]
        )
      )
    );
    await seedAttempts("visitor-1", pattern, daysAgo(0), [true, false, true]);
    await seedEvaluation(
      "visitor-1",
      new Date(NOW.getTime() - 60 * 60 * 1000),
      [],
      "work"
    );
    const foreign = await seedPattern("other-user", {
      category: "ARTICLES",
      lastPracticedAt: daysAgo(5),
      lastSeenAt: NOW,
      occurrenceCount: 9,
      patternKey: "a-an",
    });
    await seedEvaluation("other-user", NOW, [
      { category: "ARTICLES", patternId: foreign },
    ]);
    await seedAttempts("other-user", foreign, NOW, [false]);

    const response = await GET("/api/academy/dashboard");
    const dashboard = (await response.json()) as {
      readonly recentPatterns: readonly { readonly id: string }[];
      readonly recentWriting: readonly { readonly id: string }[];
    } & Record<string, unknown>;
    expect(dashboard["progress"]).toEqual({
      exerciseAccuracy: { correct: 2, total: 3 },
      exercisesCompleted: 3,
      writingSamplesCompleted: 4,
    });
    expect(dashboard["weakAreas"]).toEqual([
      { category: "PREPOSITIONS", count: 4, percentage: 100 },
    ]);
    expect(dashboard.recentPatterns.map(({ id }) => id)).toEqual([pattern]);
    expect(dashboard.recentWriting.map(({ id }) => id)).toEqual(
      written.toReversed().slice(0, 3)
    );
    expect(dashboard["dueCount"]).toBe(1);
    expect(dashboard["recommendation"]).toEqual({
      category: "PREPOSITIONS",
      exampleCorrection: "depend-on correction",
      exampleOriginal: "depend-on original",
      occurrenceCount: 3,
    });
    expect(dashboard["dailyChallenge"]).toEqual({
      promptText:
        "Describe a bug you recently solved and how you found the root cause.",
      promptType: "DAILY_CHALLENGE",
    });
  });
});

// docs/adr/0027: the dashboard's Finding-based trend, in the place of Grifando's averaged scores.
describe("GET /api/academy/dashboard trend", () => {
  it("rates the last ten practice samples under the current Rubric Version, oldest first", async () => {
    await Promise.all(
      Array.from({ length: 11 }, (_, index) =>
        seedEvaluation("visitor-1", daysAgo(11 - index), [], "practice", {
          findingCount: index % 3,
          words: 20,
        })
      )
    );
    await seedEvaluation("visitor-1", daysAgo(0), [], "practice", {
      findingCount: 5,
      rubricVersion: "0-retired",
      words: 20,
    });
    await seedEvaluation("visitor-1", daysAgo(0), [], "work", {
      findingCount: 5,
      words: 20,
    });
    await seedEvaluation("other-user", daysAgo(0), [], "practice", {
      findingCount: 5,
      words: 20,
    });

    const response = await GET("/api/academy/dashboard");
    const { findingTrend } = (await response.json()) as {
      readonly findingTrend: {
        readonly samples: readonly Record<string, unknown>[];
        readonly window: unknown;
      };
    };

    // The oldest of the eleven practice samples falls out of the window.
    expect(findingTrend.samples).toHaveLength(10);
    expect(findingTrend.samples[0]).toEqual({
      evaluatedAt: daysAgo(10).toISOString(),
      evaluatedEnglishWordCount: 20,
      findingCount: 1,
      findingRate: 5,
    });
    expect(
      findingTrend.samples.map(({ findingCount }) => findingCount)
    ).toEqual([1, 2, 0, 1, 2, 0, 1, 2, 0, 1]);
    expect(findingTrend.window).toEqual({
      evaluatedEnglishWordCount: 200,
      evaluationCount: 10,
      findingCount: 10,
      findingRate: 5,
    });
  });
});

describe("GET /api/academy/dashboard", () => {
  it("answers the generic 500 when the database fails", async () => {
    const response = await appOf({
      getAcademyDashboard: () =>
        Effect.fail(new DatabaseError({ cause: new Error("down") })),
    }).request(new Request("http://localhost/api/academy/dashboard"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Something went wrong. Please try again.",
    });
  });
});
