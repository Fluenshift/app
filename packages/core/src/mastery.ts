// Typed stub for the red commit of #15: the ported tests compile and fail on their checks.
// The tests expect both true and false, so the predicates return neither.
import type { ExerciseType, MasteryLevel } from "@fluenshift/contract";

import type { RecallState } from "./recall";

export interface MasteryState {
  masteryLevel: MasteryLevel;
  consecutiveCorrectCount: number;
}

export const needsMasteryCheck = (_state: MasteryState): boolean =>
  undefined as unknown as boolean;

export const applyExerciseResult = (
  _state: MasteryState,
  _isCorrect: boolean,
  _exerciseType?: ExerciseType
): MasteryState => ({
  consecutiveCorrectCount: Number.NaN,
  masteryLevel: "" as MasteryLevel,
});

export const isFading = (
  _pattern: MasteryState & RecallState,
  _now: Date
): boolean => undefined as unknown as boolean;
