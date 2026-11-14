// Characterization of src/server/domain/exercises/selection.ts at the Grifando baseline: the
// baseline tests use even counts only, so none of them pins how an odd count splits between
// today's mistakes and the due patterns. The fixture helper is the one in selection.test.ts.
import { describe, expect, it } from "vitest";

import { selectReviewSet } from "@/server/domain/exercises/selection";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-27T12:00:00Z");

function pattern(
  id: string,
  occurrenceCount: number,
  { correctCount = 0, incorrectCount = 1, daysSincePractice = 0 } = {},
) {
  return {
    id,
    occurrenceCount,
    correctCount,
    incorrectCount,
    lastPracticedAt: new Date(now.getTime() - daysSincePractice * DAY),
  };
}

describe("selectReviewSet guards", () => {
  it("gives today's mistakes the larger half of an odd count", () => {
    const due = [
      pattern("due-1", 1, { daysSincePractice: 5 }),
      pattern("due-2", 1, { daysSincePractice: 4 }),
      pattern("due-3", 1, { daysSincePractice: 3 }),
    ];
    const fresh = [pattern("new-1", 1), pattern("new-2", 1), pattern("new-3", 1)];

    const result = selectReviewSet([...due, ...fresh], 3, now, ["new-1", "new-2", "new-3"]);

    expect(result.map((p) => p.id)).toEqual(["new-1", "due-1", "new-2"]);
  });
});
