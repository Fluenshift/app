// Characterization of apps/server/src/progress/progress-insights.ts at the PE baseline: what
// progress-insights.test.ts leaves open because its Evaluations share one score, one moment and
// one count per category: the rounding of the average score, the bounds of a period, which
// Evaluations evidence Finding Rate, and the order of distributions, recurrences and recurring
// Corrections.
import { afterEach, describe, expect, it } from "bun:test";
import { rm } from "node:fs/promises";

import { Effect } from "effect";

import { persistEvaluation } from "../history/learning-history";
import type {
  Evaluation,
  EvaluationFinding,
} from "../history/learning-history";
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

const MOMENT = "2026-09-07T12:00:00.000Z";
const DAY = 24 * 60 * 60 * 1000;

const finding = (
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

const evaluation = (
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
  rubricVersion: "1",
  score: options.score ?? 70,
  suggestions: [],
  summary: `${id} summary`,
});

// Retains the Evaluations in order, then reads what Progress makes of them.
const afterRetaining = async <A, E, R>(
  retained: readonly Evaluation[],
  read: Effect.Effect<A, E, R>
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
    }).pipe(Effect.provide(database.layer)) as Effect.Effect<A, E, never>
  );
};

describe("Progress Insights guards", () => {
  it("rounds the average score to one decimal place", async () => {
    const summary = await afterRetaining(
      [
        evaluation("a", MOMENT, { score: 70 }),
        evaluation("b", MOMENT, { score: 71 }),
        evaluation("c", MOMENT, { score: 71 }),
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
        evaluation("week-start", ago(7 * DAY)),
        evaluation("before-week", ago(7 * DAY + 1)),
        evaluation("month-start", ago(30 * DAY)),
        evaluation("before-month", ago(30 * DAY + 1)),
        evaluation("now", ago(0)),
        evaluation("future", ago(-1)),
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
        evaluation("clean", MOMENT),
        evaluation("flawed", MOMENT, {
          findings: [finding("Spelling", "teh", "the")],
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
        evaluation("first", MOMENT, {
          findings: [
            finding("Article", "a", "an"),
            finding("Article", "a", "an"),
            finding("Spelling", "teh", "the"),
            finding("Spelling", "teh", "the"),
            finding("Preposition", "in", "on"),
            finding("Preposition", "in", "at"),
            finding("Other", "x", "y"),
          ],
        }),
        evaluation("second", MOMENT, {
          findings: [
            finding("Spelling", "teh", "the"),
            finding("Article", "a", "an"),
            finding("Preposition", "in", "on"),
            finding("Preposition", "in", "at"),
            finding("Other", "x", "y"),
            finding("Clarity", "it", "this"),
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
    expect(
      summary.categoryRecurrences.map(({ category }) => category)
    ).toEqual(["Article", "Other", "Preposition", "Spelling", "Clarity"]);
    expect(summary.recurringCorrections).toEqual([
      { correction: "an", occurrenceCount: 3, originalText: "a" },
      { correction: "the", occurrenceCount: 3, originalText: "teh" },
      { correction: "at", occurrenceCount: 2, originalText: "in" },
      { correction: "on", occurrenceCount: 2, originalText: "in" },
      { correction: "y", occurrenceCount: 2, originalText: "x" },
    ]);
  });
});
