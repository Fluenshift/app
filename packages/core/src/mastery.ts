// Ported from Grifando src/server/domain/mistakes/mastery.ts; SPEC.md is Grifando's.
import { ExerciseType, MasteryLevel } from "@fluenshift/contract";

import { isDueForReview } from "./recall";
import type { RecallState } from "./recall";

export interface MasteryState {
  masteryLevel: MasteryLevel;
  consecutiveCorrectCount: number;
}

const REQUIRED_STREAK = 2;

// Exercises that give no scaffolding (no options, no blank to fill): the
// learner produces the whole sentence. Reaching MASTERED requires one of these
// (a stricter, unscaffolded check).
const UNSCAFFOLDED_TYPES: ReadonlySet<ExerciseType> = new Set([
  ExerciseType.REWRITE,
  ExerciseType.TRANSLATION,
]);

export const isUnscaffolded = (type: ExerciseType): boolean =>
  UNSCAFFOLDED_TYPES.has(type);

// One correct answer away from MASTERED: the next exercise for this pattern
// should be the unscaffolded mastery check.
export const needsMasteryCheck = (state: MasteryState): boolean =>
  state.masteryLevel === MasteryLevel.IMPROVING &&
  state.consecutiveCorrectCount >= REQUIRED_STREAK - 1;

// Two consecutive correct attempts promote a pattern; one failed recall drops it
// one level back toward ACTIVE (SPEC.md §6). A failed recall is an incorrect
// exercise attempt or the same mistake reappearing in writing. MASTERED is not
// terminal: a failure drops it to IMPROVING, a success keeps it MASTERED.
// IMPROVING -> MASTERED additionally needs the final correct answer to come from
// an unscaffolded exercise; a correct multiple-choice/fill-blank answer at that
// point keeps the pattern waiting for its mastery check. exerciseType is
// omitted for recalls that aren't exercises (a mistake reappearing in writing).
export const applyExerciseResult = (
  state: MasteryState,
  isCorrect: boolean,
  exerciseType?: ExerciseType
): MasteryState => {
  if (state.masteryLevel === MasteryLevel.MASTERED) {
    return isCorrect
      ? state
      : { masteryLevel: MasteryLevel.IMPROVING, consecutiveCorrectCount: 0 };
  }

  if (!isCorrect) {
    return { masteryLevel: MasteryLevel.ACTIVE, consecutiveCorrectCount: 0 };
  }

  const consecutiveCorrectCount = state.consecutiveCorrectCount + 1;

  if (consecutiveCorrectCount < REQUIRED_STREAK) {
    return { masteryLevel: state.masteryLevel, consecutiveCorrectCount };
  }

  if (state.masteryLevel === MasteryLevel.ACTIVE) {
    return { masteryLevel: MasteryLevel.IMPROVING, consecutiveCorrectCount: 0 };
  }

  if (!exerciseType || !isUnscaffolded(exerciseType)) {
    return {
      masteryLevel: MasteryLevel.IMPROVING,
      consecutiveCorrectCount: REQUIRED_STREAK - 1,
    };
  }

  return { masteryLevel: MasteryLevel.MASTERED, consecutiveCorrectCount: 0 };
};

// A MASTERED pattern whose estimated recall has dropped below the review
// threshold: shown as fading (effectively IMPROVING again) until it is
// practiced. Derived on read, not stored, so it needs no background job; a
// correct attempt refreshes lastPracticedAt and it stops fading.
export const isFading = (
  pattern: MasteryState & RecallState,
  now: Date
): boolean =>
  pattern.masteryLevel === MasteryLevel.MASTERED &&
  isDueForReview(pattern, now);
