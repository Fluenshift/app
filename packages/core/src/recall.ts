// Ported from Grifando src/server/domain/mistakes/recall.ts; SPEC.md is Grifando's.
//
// Simplified Half-Life Regression (Settles & Meeder 2016; see
// SPEC.md §6.1).
//
// Recall probability decays exponentially with time since the pattern was last
// practiced: p = 2^(-Δ/h). The half-life h comes only from the pattern's own
// recall history, with fixed weights: each correct recall doubles it, each
// failed one shrinks it by √2. No per-pattern difficulty weights: they tend to
// overfit, and a single user has no data to fit them anyway.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const BASE_HALF_LIFE_DAYS = 1;
const CORRECT_WEIGHT = 1;
const INCORRECT_WEIGHT = -0.5;
const MIN_HALF_LIFE_DAYS = 0.25;
const MAX_HALF_LIFE_DAYS = 365;

export interface RecallCounters {
  correctCount: number;
  incorrectCount: number;
}

export type RecallState = RecallCounters & { lastPracticedAt: Date };

export const estimateHalfLifeDays = ({
  correctCount,
  incorrectCount,
}: RecallCounters): number => {
  const exponent =
    CORRECT_WEIGHT * correctCount + INCORRECT_WEIGHT * incorrectCount;
  const halfLife = BASE_HALF_LIFE_DAYS * 2 ** exponent;
  return Math.min(MAX_HALF_LIFE_DAYS, Math.max(MIN_HALF_LIFE_DAYS, halfLife));
};

// Below this recall probability a pattern is due for review: it sorts to the
// front of practice selection, and a MASTERED one shows as fading.
export const REVIEW_THRESHOLD = 0.5;

// 1 right after practice, 0.5 one half-life later. A lastPracticedAt in the
// future (clock skew) counts as "just practiced".
export const recallProbability = (state: RecallState, now: Date): number => {
  const elapsedDays =
    Math.max(0, now.getTime() - state.lastPracticedAt.getTime()) / MS_PER_DAY;
  return 2 ** (-elapsedDays / estimateHalfLifeDays(state));
};

export const isDueForReview = (state: RecallState, now: Date): boolean =>
  recallProbability(state, now) < REVIEW_THRESHOLD;
