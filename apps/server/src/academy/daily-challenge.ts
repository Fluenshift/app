// Today's Practice Prompt from the daily bank, biased toward the Mistake Categories the Learner
// has not mastered. Ported from Grifando src/server/domain/writing/dailyChallenge.ts (74dbb9f),
// which its /today and /write?mode=daily pages share so both show the same prompt.
import type { DailyChallenge } from "@fluenshift/contract";
import {
  DAILY_PROMPTS,
  extractActiveWeakCategories,
  selectDailyPrompt,
} from "@fluenshift/core/daily-prompt";
import { Effect } from "effect";

import { listPatterns } from "./mistake-pattern-repository";

export const dailyChallenge = Effect.fn("DailyChallenge.dailyChallenge")(
  function* () {
    const patterns = yield* listPatterns();
    const prompt = selectDailyPrompt(
      DAILY_PROMPTS,
      new Date(),
      extractActiveWeakCategories(patterns)
    );
    return {
      promptText: prompt.text,
      promptType: "DAILY_CHALLENGE",
    } satisfies DailyChallenge;
  }
);
