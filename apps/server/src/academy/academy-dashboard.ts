// The Academy dashboard. Ported from Grifando src/app/page.tsx (74dbb9f), whose Server Component
// read it, at /academy under docs/adr/0025. A writing session is a practice-origin Writing Sample
// (docs/adr/0004): its Evaluations give the writing count, the recent writing and, with the
// Attempts, the Streak. The averaged model scores are gone (docs/adr/0002).
import type { AcademyDashboard } from "@fluenshift/contract";
import { computeCategoryBreakdown } from "@fluenshift/core/analytics";
import { isDueForReview } from "@fluenshift/core/recall";
import { CURRENT_RUBRIC_VERSION } from "@fluenshift/core/rubric-v1";
import { selectPatternsForPractice } from "@fluenshift/core/selection";
import { computeStreak } from "@fluenshift/core/streak";
import { Database, evaluations, findings } from "@fluenshift/db";
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
          evaluatedAt: evaluations.evaluatedAt,
          evaluatedEnglishWordCount: evaluations.evaluatedEnglishWordCount,
          findingCount: count(findings.id),
          id: evaluations.id,
          originalText: evaluations.originalText,
          rubricVersion: evaluations.rubricVersion,
        })
        .from(evaluations)
        .leftJoin(
          findings,
          and(
            eq(findings.learnerId, evaluations.learnerId),
            eq(findings.evaluationId, evaluations.id)
          )
        )
        .where(
          and(
            eq(evaluations.learnerId, learner.id),
            eq(evaluations.origin, "practice")
          )
        )
        .groupBy(evaluations.id)
        .orderBy(
          desc(evaluations.evaluatedAt),
          desc(evaluations.insertionOrder)
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
      // Days follow the server's local time zone, as in Grifando: the app runs on the Learner's
      // machine.
      streak: computeStreak(
        [
          ...writing.map(({ evaluatedAt }) => evaluatedAt),
          ...attempts.map(({ attemptedAt }) => attemptedAt),
        ],
        now
      ),
      weakAreas: computeCategoryBreakdown(categoryCounts),
      findingTrend: findingTrendOf(writing),
    } satisfies AcademyDashboard;
  }
);
