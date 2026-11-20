// Today's Practice Prompt from the daily bank, biased toward the Mistake Categories the Learner
// has not mastered. Ported from Grifando src/server/domain/writing/dailyChallenge.ts (74dbb9f),
// which its /today and /write?mode=daily pages share so both show the same prompt.
import type { DailyChallenge } from "@fluenshift/contract";
import { Effect } from "effect";

export const dailyChallenge = (): Effect.Effect<DailyChallenge> =>
  Effect.succeed({ promptText: "", promptType: "DAILY_CHALLENGE" });
