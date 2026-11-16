// Exercises from the Learner's own Mistake Patterns, and their Attempts. Ported from Grifando
// src/server/domain/exercises/exerciseService.ts (74dbb9f): generation needs a Trainer, grading
// an Attempt is deterministic and does not, and the explanation of an Attempt never changes its
// grade.
import type { ExerciseType, GeneratedExercise } from "@fluenshift/contract";
import { Effect, Schema } from "effect";

import type { TrainerMethods } from "./trainer/trainer-model";

// A record that does not exist or belongs to another Learner: the two read alike, so ids cannot
// be probed. Ported from Grifando src/server/domain/errors.ts.
export class NotFoundError extends Schema.TaggedError<
  NotFoundError,
  { readonly brand: unique symbol }
>()("NotFoundError", { resource: Schema.String }) {}

export interface Exercise {
  readonly createdAt: Date;
  // Target difficulty 1 to 5 requested from the generator.
  readonly difficulty: number | null;
  readonly id: string;
  readonly model: string;
  readonly promptData: GeneratedExercise;
  readonly sourcePatternId: string | null;
  readonly type: ExerciseType;
}

export interface SubmitAttemptResult {
  readonly attemptId: string;
  readonly exercise: GeneratedExercise;
  readonly explanation: string;
  readonly isCorrect: boolean;
}

const PLACEHOLDER: Exercise = {
  createdAt: new Date(0),
  difficulty: null,
  id: "",
  model: "",
  promptData: {
    correctOptionIndex: 0,
    explanation: "",
    instruction: "",
    options: [],
    type: "MULTIPLE_CHOICE",
  },
  sourcePatternId: null,
  type: "MULTIPLE_CHOICE",
};

export const generatePracticeSet = (
  _trainer: TrainerMethods,
  _count?: number
): Effect.Effect<readonly Exercise[]> => Effect.succeed([PLACEHOLDER]);

export const submitAttempt = (
  _exerciseId: string,
  _learnerAnswer: string
): Effect.Effect<SubmitAttemptResult, NotFoundError> =>
  Effect.succeed({
    attemptId: "",
    exercise: PLACEHOLDER.promptData,
    explanation: "",
    isCorrect: false,
  });

export const explainAttempt = (
  _trainer: TrainerMethods,
  _input: { readonly attemptId: string; readonly exerciseId: string }
): Effect.Effect<string | null> => Effect.succeed("");
