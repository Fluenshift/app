// Today's Practice Prompt from the daily bank, biased toward the Mistake Categories the Learner
// has not mastered. Ported from Grifando src/server/domain/writing/dailyChallenge.ts (74dbb9f),
// which its /today and /write?mode=daily pages share so both show the same prompt; the Academy
// dashboard shows it too, from the patterns it has already read.
import type { DailyChallenge } from "@fluenshift/contract";
import {
  DAILY_PROMPTS,
  extractActiveWeakCategories,
  selectDailyPrompt,
} from "@fluenshift/core/daily-prompt";
import { Effect } from "effect";

import { listPatterns } from "./mistake-pattern-repository";
import type { MistakePattern } from "./mistake-pattern-repository";

// Today's Practice Prompt for the Learner with these patterns.
export const dailyChallengeFor = (
  patterns: readonly MistakePattern[],
  now: Date
): DailyChallenge => {
  const practicePrompt = selectDailyPrompt(
    DAILY_PROMPTS,
    now,
    extractActiveWeakCategories([...patterns])
  );
  return { promptText: practicePrompt.text, promptType: "DAILY_CHALLENGE" };
};

export const dailyChallenge = Effect.fn("DailyChallenge.dailyChallenge")(
  function* () {
    const patterns = yield* listPatterns();
    return dailyChallengeFor(patterns, new Date());
  }
);
