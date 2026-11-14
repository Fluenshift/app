// Typed stub for the red commit of #16: the ported tests compile and fail on their checks.
import type { MistakeCategory } from "@fluenshift/contract";

export interface CategoryCount {
  category: MistakeCategory;
  count: number;
}
export type CategoryBreakdownEntry = CategoryCount & { percentage: number };

// One entry no test builds, whatever the input, so no expected breakdown matches.
export const computeCategoryBreakdown = (
  _counts: CategoryCount[]
): CategoryBreakdownEntry[] => [
  { category: "ARTICLES", count: Number.NaN, percentage: Number.NaN },
];
