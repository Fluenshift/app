// The Academy dashboard. Ported from Grifando src/app/page.tsx (74dbb9f), whose Server Component
// read it.
import type { AcademyDashboard } from "@fluenshift/contract";
import { Effect } from "effect";

export const academyDashboard = (): Effect.Effect<AcademyDashboard> =>
  Effect.succeed({
    dailyChallenge: { promptText: "", promptType: "DAILY_CHALLENGE" },
    dueCount: 0,
    progress: {
      exerciseAccuracy: null,
      exercisesCompleted: 0,
      writingSamplesCompleted: 0,
    },
    recentPatterns: [],
    recentWriting: [],
    recommendation: null,
    streak: { activeToday: false, current: 0, longest: 0 },
    weakAreas: [],
  });
