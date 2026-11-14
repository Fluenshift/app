// Typed stub for the red commit of #17: the ported tests compile and fail on their checks.
import type { GeneratedExercise } from "@fluenshift/contract";

export type PublicExercise =
  | { type: "MULTIPLE_CHOICE"; instruction: string; options: readonly string[] }
  | { type: "FILL_BLANK"; instruction: string; template: string }
  | { type: "REWRITE"; instruction: string; original: string }
  | { type: "TRANSLATION"; instruction: string; sourceText: string };

// Returns the exercise unchanged, answer and explanation included, so no check can pass yet.
export const toPublicExercise = (exercise: GeneratedExercise): PublicExercise =>
  exercise;
