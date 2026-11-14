// Typed stub for the red commit of #16: the ported tests compile and fail on their checks.
import type { ExerciseType } from "@fluenshift/contract";

import type { MasteryState } from "./mastery";

// Two different values that are no exercise type, so no expected type matches and the
// mastery-check choice never equals the plain rotation.
export const assignExerciseType = (_index: number): ExerciseType =>
  "" as ExerciseType;

export const assignExerciseTypeFor = (
  _pattern: MasteryState,
  _index: number
): ExerciseType => "-" as ExerciseType;
