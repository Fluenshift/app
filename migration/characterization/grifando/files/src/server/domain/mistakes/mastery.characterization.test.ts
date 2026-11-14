// Characterization of src/server/domain/mistakes/mastery.ts at the Grifando baseline: the
// baseline test of isFading checks an ACTIVE pattern only, so none pins that an IMPROVING
// pattern never fades either.
import { describe, expect, it } from "vitest";

import { MasteryLevel } from "@/generated/prisma/enums";
import { isFading } from "@/server/domain/mistakes/mastery";

describe("isFading guards", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const now = new Date("2026-10-27T12:00:00Z");

  it("never flags an IMPROVING pattern, however long unpracticed", () => {
    const pattern = {
      masteryLevel: MasteryLevel.IMPROVING,
      consecutiveCorrectCount: 1,
      correctCount: 4,
      incorrectCount: 1,
      lastPracticedAt: new Date(now.getTime() - 100 * DAY),
    };

    expect(isFading(pattern, now)).toBe(false);
  });
});
