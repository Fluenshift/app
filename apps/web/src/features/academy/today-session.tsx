// The daily session: write today's challenge, then review. Ported from Grifando
// src/components/today/TodaySession.tsx (74dbb9f), in its write step; the review step arrives
// with the exercises.
import type { DailyChallenge } from "@fluenshift/contract";

import { WritingCoach } from "./writing-coach";

const STEPS = ["write", "review"] as const;

export const TodaySession = ({
  challenge,
}: {
  readonly challenge: DailyChallenge;
}) => {
  const step = "write";

  return (
    <div className="space-y-10">
      <ol aria-label="Session steps" className="flex gap-7">
        {STEPS.map((kind, index) => (
          <li
            aria-current={step === kind ? "step" : undefined}
            className={`border-b-2 pb-2 text-sm ${step === kind ? "border-foreground text-foreground" : "text-muted-foreground border-transparent"}`}
            key={kind}
          >
            <span className="font-mono text-xs">{index + 1}</span>{" "}
            {kind === "write" ? "Write" : "Review"}
          </li>
        ))}
      </ol>

      <WritingCoach initialChallenge={challenge} />
    </div>
  );
};
