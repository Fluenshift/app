// Ported from Grifando src/server/domain/progress/streak.ts; SPEC.md is Grifando's.
//
// Daily practice streak (SPEC.md §6.1).
//
// Low bar: any one activity (an analyzed piece of writing or one exercise
// attempt) makes a day count. Missing a day is forgiven automatically — a "rest
// day" — up to 2 per calendar week (Monday to Sunday) and never more than 2 in
// a row; the miss that goes past either limit ends the streak. Rest days keep a
// streak alive but don't add to it. Today only counts once it has an activity,
// so an empty today never breaks a streak.

export const REST_DAYS_PER_WEEK = 2;
const MAX_CONSECUTIVE_REST_DAYS = 2;
export const STREAK_MILESTONES = [7, 30, 100, 365] as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface StreakSummary {
  current: number;
  longest: number;
  activeToday: boolean;
}

// Calendar day in the given time zone as "YYYY-MM-DD" (en-CA formats that way).
export const toDayKey = (date: Date, timeZone?: string): string =>
  new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).format(date);

// Day keys are compared and stepped as UTC midnights, which never hits DST.
const keyToUtc = (key: string): number => Date.parse(`${key}T00:00:00Z`);

const utcToKey = (time: number): string =>
  new Date(time).toISOString().slice(0, 10);

// Monday of the key's week, as a key — identifies the calendar week.
const weekOf = (key: string): string => {
  const time = keyToUtc(key);
  const daysSinceMonday = (new Date(time).getUTCDay() + 6) % 7;
  return utcToKey(time - daysSinceMonday * MS_PER_DAY);
};

export const computeStreak = (
  activityDates: Date[],
  now: Date,
  timeZone?: string
): StreakSummary => {
  const activeDays = new Set(
    activityDates.map((date) => toDayKey(date, timeZone))
  );
  const today = toDayKey(now, timeZone);
  const activeToday = activeDays.has(today);
  const [first] = [...activeDays].toSorted();
  if (first === undefined) {
    return { current: 0, longest: 0, activeToday };
  }

  let run = 0;
  let longest = 0;
  let consecutiveRest = 0;
  let restByWeek = new Map<string, number>();

  for (
    let time = keyToUtc(first);
    time <= keyToUtc(today);
    time += MS_PER_DAY
  ) {
    const day = utcToKey(time);
    if (activeDays.has(day)) {
      run += 1;
      consecutiveRest = 0;
      longest = Math.max(longest, run);
      continue;
    }
    // Not over yet.
    if (day === today) {
      break;
    }

    const week = weekOf(day);
    const restThisWeek = (restByWeek.get(week) ?? 0) + 1;
    consecutiveRest += 1;
    if (
      restThisWeek > REST_DAYS_PER_WEEK ||
      consecutiveRest > MAX_CONSECUTIVE_REST_DAYS
    ) {
      run = 0;
      consecutiveRest = 0;
      restByWeek = new Map();
      continue;
    }
    restByWeek.set(week, restThisWeek);
  }

  return { current: run, longest, activeToday };
};

// The highest milestone reached by the current streak, if any.
export const reachedMilestone = (current: number): number | null =>
  [...STREAK_MILESTONES]
    .toReversed()
    .find((milestone) => current >= milestone) ?? null;
