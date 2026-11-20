// The Academy dashboard. Ported from Grifando src/app/page.tsx (74dbb9f), whose Server Component
// read it, at /academy under docs/adr/0025. A writing session is a practice-origin Writing Sample
// (docs/adr/0004): its Evaluations give the writing count, the recent writing and, with the
// Attempts, the Streak. The averaged model scores are gone (docs/adr/0002).
import type { AcademyDashboard } from "@fluenshift/contract";
import { computeCategoryBreakdown } from "@fluenshift/core/analytics";
import {
  DAILY_PROMPTS,
  extractActiveWeakCategories,
  selectDailyPrompt,
} from "@fluenshift/core/daily-prompt";
import { isDueForReview } from "@fluenshift/core/recall";
import { selectPatternsForPractice } from "@fluenshift/core/selection";
import { computeStreak } from "@fluenshift/core/streak";
import { Database, evaluations } from "@fluenshift/db";
import { and, desc, eq } from "drizzle-orm";
import { Effect } from "effect";

import { CurrentLearner } from "../learner-identity";
import { listAttemptOutcomes } from "./exercise-repository";
import { listPatterns } from "./mistake-pattern-repository";
import { countOccurrencesByCategory } from "./occurrence-repository";

const RECENT_LIMIT = 3;
const ACCURACY_WINDOW = 50;

// The Learner's practice-origin Writing Samples, newest first. The Academy only reads them.
const listPracticeWriting = Effect.fn("AcademyDashboard.listPracticeWriting")(
  function* () {
    const database = yield* Database;
    const learner = yield* CurrentLearner;
    return yield* database.run((client) =>
      client
        .select({
          evaluatedAt: evaluations.evaluatedAt,
          id: evaluations.id,
          originalText: evaluations.originalText,
        })
        .from(evaluations)
        .where(
          and(
            eq(evaluations.learnerId, learner.id),
            eq(evaluations.origin, "practice")
          )
        )
        .orderBy(
          desc(evaluations.evaluatedAt),
          desc(evaluations.insertionOrder)
        )
    );
  }
);

export const academyDashboard = Effect.fn("AcademyDashboard.academyDashboard")(
  function* () {
    const now = new Date();
    const patterns = yield* listPatterns();
    const categoryCounts = yield* countOccurrencesByCategory();
    const writing = yield* listPracticeWriting();
    const attempts = yield* listAttemptOutcomes();

    const prompt = selectDailyPrompt(
      DAILY_PROMPTS,
      now,
      extractActiveWeakCategories(patterns)
    );
    const [recommendation] = selectPatternsForPractice(patterns, 1, now);
    const recentAttempts = attempts.slice(0, ACCURACY_WINDOW);
    return {
      dailyChallenge: {
        promptText: prompt.text,
        promptType: "DAILY_CHALLENGE",
      },
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
    } satisfies AcademyDashboard;
  }
);
