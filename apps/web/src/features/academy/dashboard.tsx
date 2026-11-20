// The Academy dashboard's cards. Ported from Grifando src/components/dashboard/ (74dbb9f):
// StreakStatus, ProgressSummary, WeakAreas, RecentMistakes and RecentWriting. A writing session
// is a practice-origin Writing Sample (docs/adr/0004), and the averaged model scores are gone
// (docs/adr/0002). The numbers render without Grifando's count-up motion.
import type {
  AcademyDashboard,
  CategoryBreakdownEntry,
} from "@fluenshift/contract";
import { TARGET_SUCCESS } from "@fluenshift/core/difficulty";
import { REST_DAYS_PER_WEEK, reachedMilestone } from "@fluenshift/core/streak";
import type { ReactNode } from "react";

import { MISTAKE_CATEGORY_LABELS } from "./mistake-category-labels";

const MAX_CATEGORIES = 4;
const EXCERPT_LENGTH = 140;

// A light nudge, not a scoreboard: no loss-aversion warnings, rest days are
// forgiven silently.
export const StreakStatus = ({
  streak,
}: {
  readonly streak: AcademyDashboard["streak"];
}) => {
  if (streak.longest === 0) {
    return (
      <p className="prose-serif text-iron text-lg">
        Practice once today to start a streak.
      </p>
    );
  }

  const milestone = reachedMilestone(streak.current);

  return (
    <div className="space-y-2">
      <p className="text-heading-sm">
        {streak.current}-day streak
        <span className="text-muted-foreground">
          {" "}
          · longest {streak.longest}
        </span>
      </p>
      {milestone === null ? null : (
        <p className="text-success text-sm">
          {milestone}-day milestone reached
        </p>
      )}
      <p className="prose-serif text-iron text-lg">
        {streak.activeToday
          ? "Today counts already."
          : `One activity today keeps it going. Up to ${REST_DAYS_PER_WEEK} rest days a week are fine.`}
      </p>
    </div>
  );
};

const Figure = ({
  label,
  value,
}: {
  readonly label: string;
  readonly value: ReactNode;
}) => (
  <div className="space-y-2">
    <p className="text-display tabular-nums">{value}</p>
    <p className="text-muted-foreground text-sm">{label}</p>
  </div>
);

export const ProgressSummary = ({
  progress,
}: {
  readonly progress: AcademyDashboard["progress"];
}) => {
  const { exerciseAccuracy } = progress;
  const target = Math.round(TARGET_SUCCESS * 100);

  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-3">
      <Figure
        label="Writing samples"
        value={progress.writingSamplesCompleted}
      />
      <Figure label="Exercises done" value={progress.exercisesCompleted} />
      <Figure
        label={
          exerciseAccuracy === null
            ? `Exercise accuracy · aiming for about ${target}%`
            : `Accuracy over your last ${exerciseAccuracy.total} · aiming for about ${target}%`
        }
        value={
          exerciseAccuracy === null
            ? "—"
            : `${Math.round((exerciseAccuracy.correct / exerciseAccuracy.total) * 100)}%`
        }
      />
    </div>
  );
};

export const WeakAreas = ({
  breakdown,
}: {
  readonly breakdown: readonly CategoryBreakdownEntry[];
}) => {
  if (breakdown.length === 0) {
    return (
      <p className="prose-serif text-iron text-lg">
        No weak areas yet — write something to get started.
      </p>
    );
  }

  return (
    <ul className="border-border border-t">
      {breakdown.slice(0, MAX_CATEGORIES).map((entry) => (
        <li
          className="border-border space-y-3 border-b py-4"
          key={entry.category}
        >
          <div className="flex items-baseline justify-between gap-4">
            <span>{MISTAKE_CATEGORY_LABELS[entry.category]}</span>
            <span className="text-muted-foreground text-sm tabular-nums">
              {entry.percentage}% of mistakes
            </span>
          </div>
          <div aria-hidden="true" className="bg-stone/60 h-1 w-full">
            <div
              className="bg-foreground h-full"
              style={{ width: `${entry.percentage}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
};

export const RecentMistakes = ({
  patterns,
}: {
  readonly patterns: AcademyDashboard["recentPatterns"];
}) => {
  if (patterns.length === 0) {
    return <p className="text-muted-foreground">No mistakes recorded yet.</p>;
  }

  return (
    <ul className="border-border border-t">
      {patterns.map((pattern) => (
        <li
          className="prose-serif border-border border-b py-4 text-lg"
          key={pattern.id}
        >
          <span className="text-muted-foreground line-through decoration-1">
            {pattern.exampleOriginal}
          </span>{" "}
          <span aria-hidden="true">→</span>{" "}
          <span className="sr-only">corrected to</span>
          <span>{pattern.exampleCorrection}</span>
        </li>
      ))}
    </ul>
  );
};

const truncate = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max)}…` : text;

// Grifando labeled each session with its prompt type, which an Evaluation does not record.
export const RecentWriting = ({
  writing,
}: {
  readonly writing: AcademyDashboard["recentWriting"];
}) => {
  if (writing.length === 0) {
    return <p className="text-muted-foreground">No writing samples yet.</p>;
  }

  return (
    <ul className="border-border border-t">
      {writing.map((sample) => (
        <li className="border-border space-y-2 border-b py-4" key={sample.id}>
          <div className="label-mono text-muted-foreground flex items-center justify-end gap-4">
            <time dateTime={sample.evaluatedAt}>
              {new Date(sample.evaluatedAt).toLocaleDateString()}
            </time>
          </div>
          <p className="prose-serif text-lg">
            {truncate(sample.originalText, EXCERPT_LENGTH)}
          </p>
        </li>
      ))}
    </ul>
  );
};
