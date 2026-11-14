// Typed stub for the red commit of #16: the ported tests compile and fail on their checks.
// NaN fails every numeric check, and the day key and today's flag are never right.

export const REST_DAYS_PER_WEEK = 2;
export const STREAK_MILESTONES: readonly number[] = [Number.NaN];

export interface StreakSummary {
  current: number;
  longest: number;
  activeToday: boolean;
}

export const toDayKey = (_date: Date, _timeZone?: string): string => "";

export const computeStreak = (
  _activityDates: Date[],
  _now: Date,
  _timeZone?: string
): StreakSummary => ({
  activeToday: undefined as unknown as boolean,
  current: Number.NaN,
  longest: Number.NaN,
});

export const reachedMilestone = (_current: number): number | null => Number.NaN;
