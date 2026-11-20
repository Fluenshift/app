// The Mistake Notebook. Ported from Grifando src/app/mistakes/page.tsx (74dbb9f), whose Server
// Component read it: every pattern with its due and fading state and whether an Occurrence of it
// carries L1 Transfer, and the breakdowns of all time and of the last 30 days. The page applies
// its filters itself (docs/adr/0025).
import type { MistakeNotebook } from "@fluenshift/contract";
import { computeCategoryBreakdown } from "@fluenshift/core/analytics";
import { isFading } from "@fluenshift/core/mastery";
import { isDueForReview } from "@fluenshift/core/recall";
import { Effect } from "effect";

import { listPatterns } from "./mistake-pattern-repository";
import { countOccurrencesByCategory } from "./occurrence-repository";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const mistakeNotebook = Effect.fn("MistakeNotebook.mistakeNotebook")(
  function* () {
    const now = new Date();
    const patterns = yield* listPatterns();
    const l1TransferPatterns = yield* listPatterns({ l1TransferOnly: true });
    const allTime = yield* countOccurrencesByCategory();
    const last30Days = yield* countOccurrencesByCategory({
      since: new Date(now.getTime() - THIRTY_DAYS_MS),
    });
    const l1TransferIds = new Set(
      l1TransferPatterns.map((pattern) => pattern.id)
    );
    return {
      breakdown: {
        allTime: computeCategoryBreakdown(allTime),
        last30Days: computeCategoryBreakdown(last30Days),
      },
      patterns: patterns.map((pattern) => ({
        category: pattern.category,
        due: isDueForReview(pattern, now),
        exampleCorrection: pattern.exampleCorrection,
        exampleOriginal: pattern.exampleOriginal,
        fading: isFading(pattern, now),
        id: pattern.id,
        l1Transfer: l1TransferIds.has(pattern.id),
        lastSeenAt: pattern.lastSeenAt.toISOString(),
        masteryLevel: pattern.masteryLevel,
        occurrenceCount: pattern.occurrenceCount,
      })),
    } satisfies MistakeNotebook;
  }
);
