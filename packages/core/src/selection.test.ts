import { describe, expect, it } from "vitest";

import { selectPatternsForPractice, selectReviewSet } from "./selection";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-27T12:00:00Z");

const pattern = (
  id: string,
  occurrenceCount: number,
  { correctCount = 0, incorrectCount = 1, daysSincePractice = 0 } = {}
) => ({
  id,
  occurrenceCount,
  correctCount,
  incorrectCount,
  lastPracticedAt: new Date(now.getTime() - daysSincePractice * DAY),
});

describe("selectPatternsForPractice", () => {
  it("puts the pattern most likely forgotten first", () => {
    const patterns = [
      pattern("fresh", 9, { daysSincePractice: 0 }),
      pattern("stale", 1, { daysSincePractice: 3 }),
      pattern("aging", 5, { daysSincePractice: 1 }),
    ];

    expect(
      selectPatternsForPractice(patterns, 3, now).map((p) => p.id)
    ).toEqual(["stale", "aging", "fresh"]);
  });

  it("lets a well-practiced pattern wait longer than a weak one with the same gap", () => {
    const patterns = [
      pattern("strong", 1, { correctCount: 5, daysSincePractice: 2 }),
      pattern("weak", 1, { incorrectCount: 3, daysSincePractice: 2 }),
    ];

    expect(
      selectPatternsForPractice(patterns, 2, now).map((p) => p.id)
    ).toEqual(["weak", "strong"]);
  });

  it("changes the pick as a pattern ages", () => {
    // "old" is strong (half-life ~22 days) but untouched for 10 days; "new" is a
    // weak pattern (half-life ~0.7 days) practiced just now.
    const patterns = [
      pattern("old", 1, { correctCount: 5, daysSincePractice: 10 }),
      pattern("new", 1, { daysSincePractice: 0 }),
    ];
    const oneDayLater = new Date(now.getTime() + DAY);

    expect(selectPatternsForPractice(patterns, 1, now)[0]?.id).toBe("old");
    expect(selectPatternsForPractice(patterns, 1, oneDayLater)[0]?.id).toBe(
      "new"
    );
  });

  it("breaks ties by occurrence count, most frequent first", () => {
    const patterns = [pattern("rare", 1), pattern("frequent", 5)];
    expect(
      selectPatternsForPractice(patterns, 2, now).map((p) => p.id)
    ).toEqual(["frequent", "rare"]);
  });

  it("caps the result, does not mutate the input, and handles an empty list", () => {
    const patterns = [pattern("a", 1), pattern("b", 2), pattern("c", 3)];
    const original = [...patterns];
    expect(selectPatternsForPractice(patterns, 2, now)).toHaveLength(2);
    expect(patterns).toEqual(original);
    expect(selectPatternsForPractice([], 5, now)).toEqual([]);
  });
});

describe("selectReviewSet", () => {
  const due = [
    pattern("due-1", 1, { daysSincePractice: 5 }),
    pattern("due-2", 1, { daysSincePractice: 4 }),
    pattern("due-3", 1, { daysSincePractice: 3 }),
  ];
  const fresh = [pattern("new-1", 1), pattern("new-2", 1), pattern("new-3", 1)];

  it("interleaves today's mistakes with the most due patterns, half each", () => {
    const result = selectReviewSet([...due, ...fresh], 4, now, [
      "new-1",
      "new-2",
      "new-3",
    ]);
    expect(result.map((p) => p.id)).toEqual([
      "new-1",
      "due-1",
      "new-2",
      "due-2",
    ]);
  });

  it("lets fresh mistakes fill the slots when few patterns are due", () => {
    const result = selectReviewSet([...due.slice(0, 1), ...fresh], 4, now, [
      "new-1",
      "new-2",
      "new-3",
    ]);
    expect(result.map((p) => p.id)).toEqual([
      "new-1",
      "due-1",
      "new-2",
      "new-3",
    ]);
  });

  it("falls back to due patterns when the session had no mistakes", () => {
    const result = selectReviewSet([...due, ...fresh], 2, now, []);
    expect(result.map((p) => p.id)).toEqual(["due-1", "due-2"]);
  });

  it("ignores fresh ids that aren't among the patterns", () => {
    const result = selectReviewSet(due, 2, now, ["unknown"]);
    expect(result.map((p) => p.id)).toEqual(["due-1", "due-2"]);
  });
});

describe("selectReviewSet guards", () => {
  it("gives today's mistakes the larger half of an odd count", () => {
    const due = [
      pattern("due-1", 1, { daysSincePractice: 5 }),
      pattern("due-2", 1, { daysSincePractice: 4 }),
      pattern("due-3", 1, { daysSincePractice: 3 }),
    ];
    const fresh = [
      pattern("new-1", 1),
      pattern("new-2", 1),
      pattern("new-3", 1),
    ];

    const result = selectReviewSet([...due, ...fresh], 3, now, [
      "new-1",
      "new-2",
      "new-3",
    ]);

    expect(result.map((p) => p.id)).toEqual(["new-1", "due-1", "new-2"]);
  });
});
