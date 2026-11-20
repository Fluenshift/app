// A calm status line for slow Trainer calls. Ported from Grifando
// src/components/feedback/AnalyzingStatus.tsx (74dbb9f).
import { cn } from "@fluenshift/ui/utils";
import { useEffect, useState } from "react";

export const WRITING_STEPS = [
  "Reading your text…",
  "Marking mistakes…",
  "Writing explanations…",
  "Almost there — long texts take up to a minute",
];

export const INTERVIEW_STEPS = [
  "Reading your answer…",
  "Marking mistakes…",
  "Thinking of the next question…",
  "Almost there — long answers take up to a minute",
];

export const EXERCISE_STEPS = [
  "Looking through your mistakes…",
  "Picking what to practice…",
  "Writing the exercises…",
  "Almost there — this can take up to a minute",
];

export const EXPLAIN_STEPS = [
  "Reading your answer…",
  "Writing the explanation…",
  "Almost there — this can take a moment",
];

const STEP_SECONDS = 6;

// Small ring for inside a busy button. Rotates only when motion is allowed.
export const ButtonSpinner = () => (
  <span aria-hidden="true" className="spinner" />
);

// Rotates through honest steps and shows elapsed seconds. Mount it only while a request is in
// flight (the timer starts on mount). Announced politely; the spinner is decorative.
export const AnalyzingStatus = ({
  className,
  steps,
}: {
  readonly className?: string;
  readonly steps: readonly string[];
}) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, []);

  const step =
    steps[Math.min(Math.floor(elapsed / STEP_SECONDS), steps.length - 1)];

  return (
    <output
      aria-live="polite"
      className={cn(
        "text-muted-foreground flex items-center gap-3 text-sm",
        className
      )}
    >
      <ButtonSpinner />
      <span className="fade-in" key={step}>
        {step}
      </span>
      <span
        aria-hidden="true"
        className="text-smoke font-mono text-xs tabular-nums"
      >
        {elapsed}s
      </span>
    </output>
  );
};
