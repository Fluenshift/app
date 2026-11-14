// Typed stub for the red commit of #15: the ported tests compile and fail on their checks.
// Both selections return one pattern no test builds, so no list, length or id matches.
import type { RecallState } from "./recall";

export type SelectablePattern = RecallState & {
  id: string;
  occurrenceCount: number;
};

const unknownPattern: SelectablePattern = {
  correctCount: Number.NaN,
  id: "",
  incorrectCount: Number.NaN,
  lastPracticedAt: new Date(Number.NaN),
  occurrenceCount: Number.NaN,
};

export const selectPatternsForPractice = <T extends SelectablePattern>(
  _patterns: T[],
  _count: number,
  _now: Date
): T[] => [unknownPattern as T];

export const selectReviewSet = <T extends SelectablePattern>(
  _patterns: T[],
  _count: number,
  _now: Date,
  _freshIds: string[]
): T[] => [unknownPattern as T];
