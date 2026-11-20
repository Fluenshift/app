// The daily session: write today's challenge, then review a practice set that interleaves the
// mistakes just made with the patterns most due for review. One page, no navigation in between.
// Ported from Grifando src/components/today/TodaySession.tsx (74dbb9f).
import type { DailyChallenge } from "@fluenshift/contract";
import { useState } from "react";

import { ExercisePractice } from "./exercise-practice";
import { WritingCoach } from "./writing-coach";

type Step =
  | { readonly kind: "write" }
  | { readonly evaluationId: string; readonly kind: "review" };

const STEPS = ["write", "review"] as const;

export const TodaySession = ({
  challenge,
}: {
  readonly challenge: DailyChallenge;
}) => {
  const [step, setStep] = useState<Step>({ kind: "write" });

  return (
    <div className="space-y-10">
      <ol aria-label="Session steps" className="flex gap-7">
        {STEPS.map((kind, index) => (
          <li
            aria-current={step.kind === kind ? "step" : undefined}
            className={`border-b-2 pb-2 text-sm ${step.kind === kind ? "border-foreground text-foreground" : "text-muted-foreground border-transparent"}`}
            key={kind}
          >
            <span className="font-mono text-xs">{index + 1}</span>{" "}
            {kind === "write" ? "Write" : "Review"}
          </li>
        ))}
      </ol>

      {step.kind === "write" ? (
        <WritingCoach
          initialChallenge={challenge}
          nextStep={{
            label: "Continue to review",
            onClick: (evaluationId) => {
              setStep({ evaluationId, kind: "review" });
            },
          }}
        />
      ) : (
        <ExercisePractice afterEvaluationId={step.evaluationId} />
      )}
    </div>
  );
};
