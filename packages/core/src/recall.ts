// Typed stub for the red commit of #15: the ported tests compile and fail on their checks.
// NaN fails every numeric check: no equality, closeness or ordering holds for it.

export interface RecallCounters {
  correctCount: number;
  incorrectCount: number;
}

export type RecallState = RecallCounters & { lastPracticedAt: Date };

export const estimateHalfLifeDays = (_counters: RecallCounters): number =>
  Number.NaN;

export const recallProbability = (_state: RecallState, _now: Date): number =>
  Number.NaN;

export const REVIEW_THRESHOLD = Number.NaN;

// The tests expect both true and false, so the predicate returns neither.
export const isDueForReview = (_state: RecallState, _now: Date): boolean =>
  undefined as unknown as boolean;
