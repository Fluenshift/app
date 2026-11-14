// Characterization of src/server/domain/progress/streak.ts at the Grifando baseline: the
// baseline tests never put a rest day on a Sunday, so none pins that a week starts on Monday,
// and they reach the 7 and 30 milestones only.
import { describe, expect, it } from "vitest";

import { computeStreak, reachedMilestone, STREAK_MILESTONES } from "@/server/domain/progress/streak";

const TZ = "America/Sao_Paulo";

// Noon local time (UTC-3) on the given day, so day keys are unambiguous.
function day(key: string): Date {
  return new Date(`${key}T15:00:00Z`);
}

function days(...keys: string[]): Date[] {
  return keys.map(day);
}

describe("streak guards", () => {
  it("counts a Sunday rest day in the week that began on Monday", () => {
    // Mon 26, Tue, Wed, (Thu rest), Fri, (Sat rest), (Sun rest) -> the third rest of the week
    // ends the run; Mon Nov 2 starts over.
    const activity = days("2026-10-26", "2026-10-27", "2026-10-28", "2026-10-30", "2026-11-02");
    expect(computeStreak(activity, day("2026-11-02"), TZ)).toEqual({ current: 1, longest: 4, activeToday: true });
  });

  it("names 7, 30, 100 and 365 days as milestones", () => {
    expect(STREAK_MILESTONES).toEqual([7, 30, 100, 365]);
    expect([99, 100, 364, 365, 1000].map(reachedMilestone)).toEqual([30, 100, 100, 365, 365]);
  });
});
