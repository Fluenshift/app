import { describe, expect, it } from "vitest";

import {
  computeStreak,
  reachedMilestone,
  STREAK_MILESTONES,
  toDayKey,
} from "./streak";

const TZ = "America/Sao_Paulo";

// Noon local time (UTC-3) on the given day, so day keys are unambiguous.
const day = (key: string): Date => new Date(`${key}T15:00:00Z`);

const days = (...keys: string[]): Date[] => keys.map(day);

// 2026-10-26 is a Monday.
describe("computeStreak", () => {
  it("is zero without activity", () => {
    expect(computeStreak([], day("2026-10-28"), TZ)).toEqual({
      current: 0,
      longest: 0,
      activeToday: false,
    });
  });

  it("counts consecutive active days and doesn't break on an empty today", () => {
    const activity = days("2026-10-26", "2026-10-27", "2026-10-28");
    expect(computeStreak(activity, day("2026-10-28"), TZ)).toEqual({
      current: 3,
      longest: 3,
      activeToday: true,
    });
    expect(computeStreak(activity, day("2026-10-29"), TZ)).toEqual({
      current: 3,
      longest: 3,
      activeToday: false,
    });
  });

  it("forgives up to 2 rest days a week without counting them", () => {
    // Mon, (Tue rest), Wed, (Thu rest), Fri
    const activity = days("2026-10-26", "2026-10-28", "2026-10-30");
    expect(computeStreak(activity, day("2026-10-30"), TZ).current).toBe(3);
  });

  it("breaks on the third rest day in the same week", () => {
    // Mon, (Tue), Wed, (Thu), Fri, (Sat) -> 3rd miss this week; Sun starts over.
    const activity = days(
      "2026-10-26",
      "2026-10-28",
      "2026-10-30",
      "2026-11-01"
    );
    expect(computeStreak(activity, day("2026-11-01"), TZ)).toEqual({
      current: 1,
      longest: 3,
      activeToday: true,
    });
  });

  it("breaks on a third consecutive rest day even across weeks", () => {
    // Sat, (Sun, Mon, Tue) -> 3 in a row; Wed starts over.
    const activity = days("2026-10-24", "2026-10-28");
    expect(computeStreak(activity, day("2026-10-28"), TZ).current).toBe(1);
  });

  it("resets the weekly allowance in a new week", () => {
    // Week 1: Mon, (Tue), Wed, (Thu), Fri, Sat, Sun. Week 2: (Mon), Tue.
    const activity = days(
      "2026-10-26",
      "2026-10-28",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-03"
    );
    expect(computeStreak(activity, day("2026-11-03"), TZ).current).toBe(6);
  });

  it("groups activity by the local calendar day, not UTC", () => {
    // 01:00 UTC on the 27th is still the 26th in São Paulo.
    const lateNight = new Date("2026-10-27T01:00:00Z");
    expect(toDayKey(lateNight, TZ)).toBe("2026-10-26");
    expect(
      computeStreak([lateNight, day("2026-10-27")], day("2026-10-27"), TZ)
        .current
    ).toBe(2);
  });
});

describe("reachedMilestone", () => {
  it("returns the highest milestone reached", () => {
    expect(reachedMilestone(6)).toBeNull();
    expect(reachedMilestone(7)).toBe(7);
    expect(reachedMilestone(45)).toBe(30);
  });
});

describe("streak guards", () => {
  it("counts a Sunday rest day in the week that began on Monday", () => {
    // Mon 26, Tue, Wed, (Thu rest), Fri, (Sat rest), (Sun rest) -> the third rest of the week
    // ends the run; Mon Nov 2 starts over.
    const activity = days(
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-30",
      "2026-11-02"
    );
    expect(computeStreak(activity, day("2026-11-02"), TZ)).toEqual({
      current: 1,
      longest: 4,
      activeToday: true,
    });
  });

  it("names 7, 30, 100 and 365 days as milestones", () => {
    expect(STREAK_MILESTONES).toEqual([7, 30, 100, 365]);
    expect([99, 100, 364, 365, 1000].map(reachedMilestone)).toEqual([
      30, 100, 100, 365, 365,
    ]);
  });
});
