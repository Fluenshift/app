// Ported from Grifando src/server/domain/exercises/exerciseType.ts.
import { ExerciseType } from "@fluenshift/contract";

import { needsMasteryCheck } from "./mastery";
import type { MasteryState } from "./mastery";

const ROTATION = [
  ExerciseType.MULTIPLE_CHOICE,
  ExerciseType.FILL_BLANK,
  ExerciseType.REWRITE,
  ExerciseType.TRANSLATION,
] as const;

// Cycles deterministically through the four exercise types rather than
// letting the model choose, so a practice set stays varied and predictable.
// As in Grifando, a negative index reads past the rotation as undefined.
export const assignExerciseType = (index: number): ExerciseType =>
  ROTATION[index % ROTATION.length] as ExerciseType;

const MASTERY_CHECK_ROTATION = [
  ExerciseType.REWRITE,
  ExerciseType.TRANSLATION,
] as const;

// A pattern one step from MASTERED gets its unscaffolded mastery check
// (REWRITE or TRANSLATION); every other pattern follows the normal rotation.
export const assignExerciseTypeFor = (
  pattern: MasteryState,
  index: number
): ExerciseType =>
  needsMasteryCheck(pattern)
    ? (MASTERY_CHECK_ROTATION[
        index % MASTERY_CHECK_ROTATION.length
      ] as ExerciseType)
    : assignExerciseType(index);
