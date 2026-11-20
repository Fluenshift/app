// The Mistake Notebook. Ported from Grifando src/app/mistakes/page.tsx (74dbb9f), whose Server
// Component read it.
import type { MistakeNotebook } from "@fluenshift/contract";
import { Effect } from "effect";

export const mistakeNotebook = (): Effect.Effect<MistakeNotebook> =>
  Effect.succeed({ breakdown: { allTime: [], last30Days: [] }, patterns: [] });
