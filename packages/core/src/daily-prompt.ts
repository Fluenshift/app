// Typed stub for the red commit of #16: the ported tests compile and fail on their checks.
import type { MistakeCategory } from "@fluenshift/contract";

export interface DailyPrompt {
  id: string;
  text: string;
  focusCategories: MistakeCategory[];
}

// An empty bank; a pick named after the UTC hour, so the same-day check (two hours of one day)
// and the different-day check (midnights of thirty days) both fail; one category no test
// expects.
export const DAILY_PROMPTS: DailyPrompt[] = [];

export const selectDailyPrompt = (
  _prompts: DailyPrompt[],
  date: Date,
  _weakCategories: MistakeCategory[] = []
): DailyPrompt => ({
  focusCategories: [],
  id: String(date.getUTCHours()),
  text: "",
});

export const extractActiveWeakCategories = (
  _patterns: { category: MistakeCategory; masteryLevel: string }[]
): MistakeCategory[] => ["SPELLING"];
