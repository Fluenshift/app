// Exercises from the Learner's own Mistake Patterns, and their Attempts. Ported from Grifando
// src/server/domain/exercises/exerciseService.ts (74dbb9f): generation needs a Trainer, grading
// an Attempt is deterministic and does not, and the explanation of an Attempt never changes its
// grade.
import type { GeneratedExercise } from "@fluenshift/contract";
import { evaluateExerciseAnswer } from "@fluenshift/core/answer-checking";
import {
  DEFAULT_ABILITY,
  targetLevel,
  updateAbility,
} from "@fluenshift/core/difficulty";
import { assignExerciseTypeFor } from "@fluenshift/core/exercise-type";
import { applyExerciseResult } from "@fluenshift/core/mastery";
import {
  selectPatternsForPractice,
  selectReviewSet,
} from "@fluenshift/core/selection";
import { Effect } from "effect";

import { getRatings, setRating } from "./category-ability-repository";
import { NotFoundError } from "./errors";
import {
  createAttempt,
  createExercises,
  findAttempt,
  findExercise,
} from "./exercise-repository";
import {
  findPattern,
  listPatternIdsForEvaluation,
  listPatterns,
  recordAttempt,
} from "./mistake-pattern-repository";
import type { TrainerMethods } from "./trainer/trainer-model";

export type { Exercise } from "./exercise-repository";
export { NotFoundError } from "./errors";

export interface SubmitAttemptResult {
  readonly attemptId: string;
  readonly exercise: GeneratedExercise;
  readonly explanation: string;
  readonly isCorrect: boolean;
}

const DEFAULT_PRACTICE_SET_SIZE = 4;

// Builds a practice set from the Learner's actual weak patterns, never generic, random English
// exercises (Grifando SPEC.md §5.4). Each Exercise records the model that generated it.
export const generatePracticeSet = Effect.fn(
  "ExerciseService.generatePracticeSet"
)(function* (
  trainer: TrainerMethods,
  count = DEFAULT_PRACTICE_SET_SIZE,
  options: { readonly afterEvaluationId?: string } = {}
) {
  const allPatterns = yield* listPatterns();
  const now = new Date();
  // The daily session: after a piece of writing, the patterns of that Evaluation's Occurrences
  // are interleaved with the most-due older patterns (Grifando's afterSessionId).
  const selected =
    options.afterEvaluationId === undefined
      ? selectPatternsForPractice([...allPatterns], count, now)
      : selectReviewSet(
          [...allPatterns],
          count,
          now,
          yield* listPatternIdsForEvaluation(options.afterEvaluationId)
        );

  if (selected.length === 0) {
    return [];
  }

  const ratings = yield* getRatings();
  const targets = selected.map((pattern, index) => ({
    category: pattern.category,
    difficulty: targetLevel(ratings.get(pattern.category) ?? DEFAULT_ABILITY),
    exampleCorrection: pattern.exampleCorrection,
    exampleOriginal: pattern.exampleOriginal,
    type: assignExerciseTypeFor(pattern, index),
  }));

  const generated = yield* trainer.generateExercises(targets);

  return yield* createExercises(
    generated.exercises.flatMap((item, index) => {
      const pattern = selected[index];
      const target = targets[index];
      return pattern === undefined || target === undefined
        ? []
        : [
            {
              difficulty: target.difficulty,
              model: generated.model,
              promptData: item,
              sourcePatternId: pattern.id,
              type: item.type,
            },
          ];
    })
  );
});

// Grades one answer against its Exercise and moves the pattern's mastery, recall counters and
// Category Ability; no Trainer takes part.
export const submitAttempt = Effect.fn("ExerciseService.submitAttempt")(
  function* (exerciseId: string, learnerAnswer: string) {
    const exercise = yield* findExercise(exerciseId);
    if (exercise === null) {
      return yield* new NotFoundError({ resource: "Exercise" });
    }

    const { promptData } = exercise;
    const isCorrect = evaluateExerciseAnswer(promptData, learnerAnswer);

    // One moment for the Attempt and for the recall it records on the pattern, so a pattern
    // replayed from its Attempts gets the same time back (docs/adr/0031).
    const now = new Date();
    const attempt = yield* createAttempt({
      attemptedAt: now,
      exerciseId,
      feedback: promptData.explanation,
      isCorrect,
      learnerAnswer,
    });

    const pattern =
      exercise.sourcePatternId === null
        ? null
        : yield* findPattern(exercise.sourcePatternId);
    if (pattern !== null) {
      const nextState = applyExerciseResult(
        {
          consecutiveCorrectCount: pattern.consecutiveCorrectCount,
          masteryLevel: pattern.masteryLevel,
        },
        isCorrect,
        exercise.type
      );
      yield* recordAttempt(pattern.id, {
        ...nextState,
        attemptedAt: now,
        isCorrect,
      });

      if (exercise.difficulty !== null) {
        const ratings = yield* getRatings();
        const ability = ratings.get(pattern.category) ?? DEFAULT_ABILITY;
        yield* setRating(
          pattern.category,
          updateAbility(ability, exercise.difficulty, isCorrect)
        );
      }
    }

    const result: SubmitAttemptResult = {
      attemptId: attempt.id,
      exercise: promptData,
      explanation: promptData.explanation,
      isCorrect,
    };
    return result;
  }
);

// "Explain my answer": an optional explanation of one graded Attempt, or null when the Learner
// has no such Attempt on that Exercise. It never changes the grade and is not stored: the
// Attempt's feedback keeps the answer key's explanation.
export const explainAttempt = Effect.fn("ExerciseService.explainAttempt")(
  function* (
    trainer: TrainerMethods,
    input: { readonly attemptId: string; readonly exerciseId: string }
  ) {
    const attempt = yield* findAttempt(input);
    if (attempt === null) {
      return null;
    }

    const { explanation } = yield* trainer.explainAttempt({
      exercise: attempt.exercise.promptData,
      learnerAnswer: attempt.learnerAnswer,
    });
    return explanation;
  }
);
