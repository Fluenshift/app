import { rm } from "node:fs/promises";

import { CURRENT_RUBRIC_VERSION } from "@fluenshift/core/rubric-v1";
import type { Database } from "@fluenshift/db";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import {
  deleteEvaluation,
  persistEvaluation,
} from "../history/learning-history";
import type {
  Evaluation,
  EvaluationFinding,
} from "../history/learning-history";
import type { CurrentLearner } from "../learner-identity";
import { makeTemporaryDatabase } from "../test/database";
import { getProgressEvidence, getProgressSummary } from "./progress-insights";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
});

const evaluation = (
  id: string,
  evaluatedAt: string,
  rubricVersion = CURRENT_RUBRIC_VERSION
): Evaluation => ({
  band: "Clear",
  correctedText: "The command fails.",
  evaluatedAt,
  evaluatedEnglishWordCount: 100,
  findings: [
    {
      byteEnd: 11,
      byteStart: 4,
      category: "Verb form/tense",
      correction: "command",
      explanation: "The verb form needs agreement.",
      originalText: "command",
      severity: "Minor",
    },
    {
      byteEnd: 17,
      byteStart: 12,
      category: "Verb form/tense",
      correction: "fails",
      explanation: "The singular subject needs a singular verb.",
      originalText: "fails",
      severity: "Minor",
    },
  ],
  id,
  model: "test-model",
  originalText: "The command fails.",
  provider: "test",
  rubricVersion,
  score: 70,
  suggestions: [
    {
      alternative: "Run it.",
      byteEnd: 3,
      byteStart: 0,
      explanation: "Tone depends on context.",
      originalText: "The",
    },
  ],
  summary: `${id} summary`,
});

const retain = (value: Evaluation) =>
  persistEvaluation({
    contentHash: `${value.id}-hash`,
    evaluation: value,
    latencyMilliseconds: 1,
    submittedAt: value.evaluatedAt,
  });

describe("Progress Insights", () => {
  it("treats all as every retained Evaluation despite clock rollback", async () => {
    const database = await makeTemporaryDatabase();
    directories.push(database.directory);
    const now = new Date("2026-09-08T12:00:00.000Z");

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* retain(evaluation("future", "2026-09-09T12:00:00.000Z"));
        return {
          all: yield* getProgressSummary({ period: "all" }, now),
          rolling: yield* getProgressSummary({ period: "30-days" }, now),
        };
      }).pipe(Effect.provide(database.layer))
    );

    expect(result.all.evaluationCount).toBe(1);
    expect(result.rolling.evaluationCount).toBe(0);
  });

  it("segments exact period evidence by Rubric Version", async () => {
    const database = await makeTemporaryDatabase();
    directories.push(database.directory);
    const now = new Date("2026-09-08T12:00:00.000Z");

    const summary = await Effect.runPromise(
      Effect.gen(function* () {
        yield* retain(evaluation("current", "2026-09-07T12:00:00.000Z"));
        yield* retain(evaluation("older", "2026-08-20T12:00:00.000Z"));
        yield* retain(
          evaluation("incompatible", "2026-09-06T12:00:00.000Z", "2")
        );
        yield* retain(evaluation("future", "2026-09-09T12:00:00.000Z"));
        return yield* getProgressSummary({ period: "7-days" }, now);
      }).pipe(Effect.provide(database.layer))
    );

    expect(summary).toMatchObject({
      evaluatedEnglishWordCount: 100,
      evaluationCount: 1,
      findingCount: 2,
      findingRate: 2,
      incompatibleSegments: [{ evaluationCount: 1, rubricVersion: "2" }],
      period: "7-days",
      rubricVersion: CURRENT_RUBRIC_VERSION,
    });
    expect(summary.categoryRecurrences).toEqual([
      {
        category: "Verb form/tense",
        evaluationCount: 1,
        recurrencePercentage: 100,
      },
    ]);
  });

  it("labels evidence with the provisional Rubric Version it reads", async () => {
    const database = await makeTemporaryDatabase();
    directories.push(database.directory);
    const evidence = await Effect.runPromise(
      getProgressEvidence(
        { period: "all", selection: { kind: "average-score" } },
        new Date("2026-09-08T12:00:00.000Z")
      ).pipe(Effect.provide(database.layer))
    );

    expect(evidence.rubricVersion).toBe("1-provisional");
  });

  it("traces every selected Finding while counting each Evaluation once", async () => {
    const database = await makeTemporaryDatabase();
    directories.push(database.directory);
    const now = new Date("2026-09-08T12:00:00.000Z");

    const evidence = await Effect.runPromise(
      Effect.gen(function* () {
        yield* retain(evaluation("source", "2026-09-07T12:00:00.000Z"));
        return yield* getProgressEvidence(
          {
            period: "30-days",
            selection: { category: "Verb form/tense", kind: "category" },
          },
          now
        );
      }).pipe(Effect.provide(database.layer))
    );

    expect(evidence.evaluations.map(({ id }) => id)).toEqual(["source"]);
    expect(evidence.findings.map(({ findingIndex }) => findingIndex)).toEqual([
      0, 1,
    ]);
    expect(JSON.stringify(evidence)).not.toContain("Tone depends on context");
  });

  it("traces correction, Finding Rate, and average-score source evidence", async () => {
    const database = await makeTemporaryDatabase();
    directories.push(database.directory);
    const now = new Date("2026-09-08T12:00:00.000Z");

    const evidence = await Effect.runPromise(
      Effect.gen(function* () {
        yield* retain(evaluation("source", "2026-09-07T12:00:00.000Z"));
        const correction = yield* getProgressEvidence(
          {
            period: "all",
            selection: {
              correction: "fails",
              kind: "correction",
              originalText: "fails",
            },
          },
          now
        );
        const findingRate = yield* getProgressEvidence(
          {
            period: "all",
            selection: { kind: "finding-rate" },
          },
          now
        );
        const averageScore = yield* getProgressEvidence(
          {
            period: "all",
            selection: { kind: "average-score" },
          },
          now
        );
        return { averageScore, correction, findingRate };
      }).pipe(Effect.provide(database.layer))
    );

    expect(evidence.correction).toMatchObject({
      evaluations: [{ id: "source" }],
      findings: [{ correction: "fails", evaluationId: "source" }],
    });
    expect(evidence.findingRate).toMatchObject({
      evaluations: [{ id: "source" }],
      findings: [{ evaluationId: "source" }, { evaluationId: "source" }],
    });
    expect(evidence.averageScore).toMatchObject({
      evaluations: [{ id: "source" }],
      findings: [],
    });
  });

  it("returns exact category recurrence ratios for the browser to format", async () => {
    const database = await makeTemporaryDatabase();
    directories.push(database.directory);
    const now = new Date("2026-09-08T12:00:00.000Z");

    const summary = await Effect.runPromise(
      Effect.gen(function* () {
        yield* retain(evaluation("with-finding", "2026-09-07T12:00:00.000Z"));
        yield* retain({
          ...evaluation("without-1", "2026-09-06T12:00:00.000Z"),
          findings: [],
        });
        yield* retain({
          ...evaluation("without-2", "2026-09-05T12:00:00.000Z"),
          findings: [],
        });
        return yield* getProgressSummary({ period: "30-days" }, now);
      }).pipe(Effect.provide(database.layer))
    );

    expect(summary.categoryRecurrences[0]?.recurrencePercentage).toBe(
      (1 / 3) * 100
    );
  });

  it("recomputes every aggregate from retained rows after deletion", async () => {
    const database = await makeTemporaryDatabase();
    directories.push(database.directory);
    const now = new Date("2026-09-08T12:00:00.000Z");

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* retain(evaluation("keep", "2026-09-07T12:00:00.000Z"));
        yield* retain(evaluation("remove", "2026-09-06T12:00:00.000Z"));
        const before = yield* getProgressSummary({ period: "30-days" }, now);
        yield* deleteEvaluation("remove");
        const after = yield* getProgressSummary({ period: "30-days" }, now);
        return { after, before };
      }).pipe(Effect.provide(database.layer))
    );

    expect(result.before).toMatchObject({
      averageBand: "Clear",
      averageScore: 70,
      categoryDistributions: [{ category: "Verb form/tense", findingCount: 4 }],
      categoryRecurrences: [
        {
          category: "Verb form/tense",
          evaluationCount: 2,
          recurrencePercentage: 100,
        },
      ],
      evaluatedEnglishWordCount: 200,
      evaluationCount: 2,
      findingCount: 4,
      findingRate: 2,
      recurringCorrections: [
        {
          correction: "command",
          occurrenceCount: 2,
          originalText: "command",
        },
        {
          correction: "fails",
          occurrenceCount: 2,
          originalText: "fails",
        },
      ],
    });
    expect(result.after).toMatchObject({
      evaluatedEnglishWordCount: 100,
      evaluationCount: 1,
      findingCount: 2,
      findingRate: 2,
      recurringCorrections: [],
    });
  });
});

const MOMENT = "2026-09-07T12:00:00.000Z";
const DAY = 24 * 60 * 60 * 1000;

const findingOf = (
  category: EvaluationFinding["category"],
  originalText: string,
  correction: string
): EvaluationFinding => ({
  byteEnd: 1,
  byteStart: 0,
  category,
  correction,
  explanation: "Characterized.",
  originalText,
  severity: "Minor",
});

const retainedEvaluation = (
  id: string,
  evaluatedAt: string,
  options: {
    readonly findings?: readonly EvaluationFinding[];
    readonly score?: number;
  } = {}
): Evaluation => ({
  band: "Clear",
  correctedText: "Text.",
  evaluatedAt,
  evaluatedEnglishWordCount: 100,
  findings: options.findings ?? [],
  id,
  model: "test-model",
  originalText: "Text.",
  provider: "test",
  rubricVersion: CURRENT_RUBRIC_VERSION,
  score: options.score ?? 70,
  suggestions: [],
  summary: `${id} summary`,
});

// Retains the Evaluations in order, then reads what Progress makes of them.
const afterRetaining = async <A, E>(
  retained: readonly Evaluation[],
  read: Effect.Effect<A, E, Database | CurrentLearner>
) => {
  const database = await makeTemporaryDatabase();
  directories.push(database.directory);
  return Effect.runPromise(
    Effect.gen(function* () {
      for (const value of retained) {
        yield* persistEvaluation({
          contentHash: `${value.id}-hash`,
          evaluation: value,
          latencyMilliseconds: 1,
          submittedAt: value.evaluatedAt,
        });
      }
      return yield* read;
    }).pipe(Effect.provide(database.layer))
  );
};

describe("Progress Insights guards", () => {
  it("rounds the average score to one decimal place", async () => {
    const summary = await afterRetaining(
      [
        retainedEvaluation("a", MOMENT, { score: 70 }),
        retainedEvaluation("b", MOMENT, { score: 71 }),
        retainedEvaluation("c", MOMENT, { score: 71 }),
      ],
      getProgressSummary({ period: "all" })
    );

    expect(summary.averageScore).toBe(70.7);
    expect(summary.averageBand).toBe("Clear");
  });

  it("keeps the first millisecond of a 7-day or 30-day period and nothing before it or after now", async () => {
    const now = new Date("2026-09-30T12:00:00.000Z");
    const ago = (milliseconds: number) =>
      new Date(now.getTime() - milliseconds).toISOString();
    const counts = await afterRetaining(
      [
        retainedEvaluation("week-start", ago(7 * DAY)),
        retainedEvaluation("before-week", ago(7 * DAY + 1)),
        retainedEvaluation("month-start", ago(30 * DAY)),
        retainedEvaluation("before-month", ago(30 * DAY + 1)),
        retainedEvaluation("now", ago(0)),
        retainedEvaluation("future", ago(-1)),
      ],
      Effect.all([
        getProgressSummary({ period: "7-days" }, now),
        getProgressSummary({ period: "30-days" }, now),
      ])
    );

    expect(counts.map(({ evaluationCount }) => evaluationCount)).toEqual([
      2, 4,
    ]);
  });

  it("evidences Finding Rate and the average score with every retained Evaluation, even one without Findings", async () => {
    const [rate, average] = await afterRetaining(
      [
        retainedEvaluation("clean", MOMENT),
        retainedEvaluation("flawed", MOMENT, {
          findings: [findingOf("Spelling", "teh", "the")],
        }),
      ],
      Effect.all([
        getProgressEvidence({
          period: "all",
          selection: { kind: "finding-rate" },
        }),
        getProgressEvidence({
          period: "all",
          selection: { kind: "average-score" },
        }),
      ])
    );

    expect(rate.evaluations.map(({ id }) => id)).toEqual(["flawed", "clean"]);
    expect(rate.findings.map(({ evaluationId }) => evaluationId)).toEqual([
      "flawed",
    ]);
    expect(average.evaluations.map(({ id }) => id)).toEqual([
      "flawed",
      "clean",
    ]);
    expect(average.findings).toEqual([]);
  });

  it("orders distributions and recurrences by count, then category, and recurring Corrections by occurrences, original text and Correction", async () => {
    const summary = await afterRetaining(
      [
        retainedEvaluation("first", MOMENT, {
          findings: [
            findingOf("Article", "a", "an"),
            findingOf("Article", "a", "an"),
            findingOf("Spelling", "teh", "the"),
            findingOf("Spelling", "teh", "the"),
            findingOf("Preposition", "in", "on"),
            findingOf("Preposition", "in", "at"),
            findingOf("Other", "x", "y"),
          ],
        }),
        retainedEvaluation("second", MOMENT, {
          findings: [
            findingOf("Spelling", "teh", "the"),
            findingOf("Article", "a", "an"),
            findingOf("Preposition", "in", "on"),
            findingOf("Preposition", "in", "at"),
            findingOf("Other", "x", "y"),
            findingOf("Clarity", "it", "this"),
          ],
        }),
      ],
      getProgressSummary({ period: "all" })
    );

    expect(summary.categoryDistributions).toEqual([
      { category: "Preposition", findingCount: 4 },
      { category: "Article", findingCount: 3 },
      { category: "Spelling", findingCount: 3 },
      { category: "Other", findingCount: 2 },
      { category: "Clarity", findingCount: 1 },
    ]);
    expect(summary.categoryRecurrences.map(({ category }) => category)).toEqual(
      ["Article", "Other", "Preposition", "Spelling", "Clarity"]
    );
    expect(summary.recurringCorrections).toEqual([
      { correction: "an", occurrenceCount: 3, originalText: "a" },
      { correction: "the", occurrenceCount: 3, originalText: "teh" },
      { correction: "at", occurrenceCount: 2, originalText: "in" },
      { correction: "on", occurrenceCount: 2, originalText: "in" },
      { correction: "y", occurrenceCount: 2, originalText: "x" },
    ]);
  });
});
