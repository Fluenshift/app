import { MistakeCategory } from "@fluenshift/contract";
import { describe, expect, it } from "vitest";

import { computeCategoryBreakdown } from "./analytics";

describe("computeCategoryBreakdown", () => {
  it("computes percentages relative to the total count", () => {
    const result = computeCategoryBreakdown([
      { category: MistakeCategory.PREPOSITIONS, count: 3 },
      { category: MistakeCategory.ARTICLES, count: 1 },
    ]);

    expect(result).toEqual([
      { category: MistakeCategory.PREPOSITIONS, count: 3, percentage: 75 },
      { category: MistakeCategory.ARTICLES, count: 1, percentage: 25 },
    ]);
  });

  it("sorts by count descending regardless of input order", () => {
    const result = computeCategoryBreakdown([
      { category: MistakeCategory.ARTICLES, count: 1 },
      { category: MistakeCategory.VOCABULARY, count: 5 },
      { category: MistakeCategory.SPELLING, count: 2 },
    ]);

    expect(result.map((entry) => entry.category)).toEqual([
      MistakeCategory.VOCABULARY,
      MistakeCategory.SPELLING,
      MistakeCategory.ARTICLES,
    ]);
  });

  it("returns an empty array without dividing by zero when there are no counts", () => {
    expect(computeCategoryBreakdown([])).toEqual([]);
  });

  it("rounds percentages to one decimal place", () => {
    const result = computeCategoryBreakdown([
      { category: MistakeCategory.PREPOSITIONS, count: 1 },
      { category: MistakeCategory.ARTICLES, count: 2 },
    ]);

    expect(result[0]?.percentage).toBeCloseTo(66.7, 1);
    expect(result[1]?.percentage).toBeCloseTo(33.3, 1);
  });
});
