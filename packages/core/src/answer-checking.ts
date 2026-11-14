// Typed stub for the red commit of #17: the ported tests compile and fail on their checks.
import type { GeneratedExercise } from "@fluenshift/contract";

// Neither true nor false, so no check can pass yet.
const UNDECIDED = undefined as unknown as boolean;

export const isTextAnswerAcceptable: (
  userAnswer: string,
  acceptableAnswers: readonly string[]
) => boolean = () => UNDECIDED;

export const isMultipleChoiceCorrect: (
  selectedIndex: number,
  correctOptionIndex: number
) => boolean = () => UNDECIDED;

export const evaluateExerciseAnswer: (
  exercise: GeneratedExercise,
  userAnswer: string
) => boolean = () => UNDECIDED;
