// Characterization of src/server/domain/mistakes/recall.ts at the Grifando baseline: no
// baseline test calls isDueForReview, so none pins its threshold or which side of it a recall
// of exactly 0.5 falls on.
import { describe, expect, it } from "vitest";

import { isDueForReview, REVIEW_THRESHOLD } from "@/server/domain/mistakes/recall";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-27T12:00:00Z");

describe("isDueForReview", () => {
  it("is due only once recall falls below 0.5", () => {
    // correctCount 2 + incorrectCount 0 -> half-life 4 days, so recall is exactly 0.5 at 4 days.
    const counters = { correctCount: 2, incorrectCount: 0 };

    expect(REVIEW_THRESHOLD).toBe(0.5);
    expect(isDueForReview({ ...counters, lastPracticedAt: new Date(now.getTime() - 4 * DAY) }, now)).toBe(false);
    expect(isDueForReview({ ...counters, lastPracticedAt: new Date(now.getTime() - 4 * DAY - 1) }, now)).toBe(true);
  });
});
