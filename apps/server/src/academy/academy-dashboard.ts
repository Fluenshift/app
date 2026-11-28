// The Academy dashboard. Ported from Grifando src/app/page.tsx (74dbb9f), whose Server Component
// read it, at /academy under docs/adr/0025. A writing session is a practice-origin Writing Sample
// (docs/adr/0004): its Evaluations give the writing count and the recent writing. The averaged
// model scores are gone (docs/adr/0002), and so is every game element (docs/adr/0046).
import type { AcademyDashboard } from "@grifando/contract";
import { computeCategoryBreakdown } from "@grifando/core/analytics";
import { isDueForReview } from "@grifando/core/recall";
import { CURRENT_RUBRIC_VERSION } from "@grifando/core/rubric-v1";
import { selectPatternsForPractice } from "@grifando/core/selection";
import { Database, evaluationsView, findingsView } from "@grifando/db";
import { and, count, desc, eq } from "drizzle-orm";
import { Effect } from "effect";

import { CurrentLearner } from "../learner-identity";
import { dailyChallengeFor } from "./daily-challenge";
import { listAttemptOutcomes } from "./exercise-repository";
import { listPatterns } from "./mistake-pattern-repository";
import { countOccurrencesByCategory } from "./occurrence-repository";

const RECENT_LIMIT = 3;
const ACCURACY_WINDOW = 50;
// As many samples as Grifando's score trend averaged (SCORE_TREND_LIMIT, docs/adr/0027).
const TREND_LIMIT = 10;

// The Learner's practice-origin Writing Samples, newest first. The Academy only reads them.
const listPracticeWriting = Effect.fn("AcademyDashboard.listPracticeWriting")(
  function* () {
    const database = yield* Database;
    const learner = yield* CurrentLearner;
    return yield* database.run((client) =>
      client
        .select({
          evaluatedAt: evaluationsView.evaluatedAt,
          evaluatedEnglishWordCount: evaluationsView.evaluatedEnglishWordCount,
          findingCount: count(findingsView.id),
          id: evaluationsView.id,
          originalText: evaluationsView.originalText,
          rubricVersion: evaluationsView.rubricVersion,
        })
        .from(evaluationsView)
        .leftJoin(
          findingsView,
          and(
            eq(findingsView.learnerId, evaluationsView.learnerId),
            eq(findingsView.evaluationId, evaluationsView.id)
          )
        )
        .where(
          and(
            eq(evaluationsView.learnerId, learner.id),
            eq(evaluationsView.origin, "practice")
          )
        )
        .groupBy(evaluationsView.id)
        .orderBy(
          desc(evaluationsView.evaluatedAt),
          desc(evaluationsView.insertionOrder)
        )
    );
  }
);

// Findings per 100 evaluated English words (RUBRIC.md, Progress Insights).
const findingRate = (findingCount: number, words: number) =>
  words === 0 ? null : (findingCount / words) * 100;

// The Finding Rate of the last practice samples under the current Rubric Version, oldest first,
// and of the window (docs/adr/0027).
const findingTrendOf = (
  writing: readonly {
    readonly evaluatedAt: Date;
    readonly evaluatedEnglishWordCount: number;
    readonly findingCount: number;
    readonly rubricVersion: string;
  }[]
): AcademyDashboard["findingTrend"] => {
  const samples = writing
    .filter((sample) => sample.rubricVersion === CURRENT_RUBRIC_VERSION)
    .slice(0, TREND_LIMIT)
    .toReversed();
  const totalWords = samples.reduce(
    (total, sample) => total + sample.evaluatedEnglishWordCount,
    0
  );
  const totalFindings = samples.reduce(
    (total, sample) => total + sample.findingCount,
    0
  );
  return {
    samples: samples.map((sample) => ({
      evaluatedAt: sample.evaluatedAt.toISOString(),
      evaluatedEnglishWordCount: sample.evaluatedEnglishWordCount,
      findingCount: sample.findingCount,
      findingRate:
        findingRate(sample.findingCount, sample.evaluatedEnglishWordCount) ?? 0,
    })),
    window: {
      evaluatedEnglishWordCount: totalWords,
      evaluationCount: samples.length,
      findingCount: totalFindings,
      findingRate: findingRate(totalFindings, totalWords),
    },
  };
};

export const academyDashboard = Effect.fn("AcademyDashboard.academyDashboard")(
  function* () {
    const now = new Date();
    const patterns = yield* listPatterns();
    const categoryCounts = yield* countOccurrencesByCategory();
    const writing = yield* listPracticeWriting();
    const attempts = yield* listAttemptOutcomes();

    const [recommendation] = selectPatternsForPractice(patterns, 1, now);
    const recentAttempts = attempts.slice(0, ACCURACY_WINDOW);
    return {
      dailyChallenge: dailyChallengeFor(patterns, now),
      dueCount: patterns.filter((pattern) => isDueForReview(pattern, now))
        .length,
      progress: {
        exerciseAccuracy:
          recentAttempts.length === 0
            ? null
            : {
                correct: recentAttempts.filter((attempt) => attempt.isCorrect)
                  .length,
                total: recentAttempts.length,
              },
        exercisesCompleted: attempts.length,
        writingSamplesCompleted: writing.length,
      },
      recentPatterns: patterns
        .toSorted((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
        .slice(0, RECENT_LIMIT)
        .map(({ exampleCorrection, exampleOriginal, id }) => ({
          exampleCorrection,
          exampleOriginal,
          id,
        })),
      recentWriting: writing
        .slice(0, RECENT_LIMIT)
        .map(({ evaluatedAt, id, originalText }) => ({
          evaluatedAt: evaluatedAt.toISOString(),
          id,
          originalText,
        })),
      recommendation:
        recommendation === undefined
          ? null
          : {
              category: recommendation.category,
              exampleCorrection: recommendation.exampleCorrection,
              exampleOriginal: recommendation.exampleOriginal,
              occurrenceCount: recommendation.occurrenceCount,
            },
      weakAreas: computeCategoryBreakdown(categoryCounts),
      findingTrend: findingTrendOf(writing),
    } satisfies AcademyDashboard;
  }
);
