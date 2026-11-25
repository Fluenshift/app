// A marginal note for one Occurrence of a practice Writing Sample. Ported from Grifando
// src/components/writing/MistakeCard.tsx (74dbb9f); "Save to vocabulary" hands the vocabulary form
// its prefill in history state, never in the URL (docs/adr/0025).
import type { EvaluationFinding, PracticeOccurrence } from "@grifando/contract";
import { Badge } from "@grifando/ui/components/badge";
import { Link } from "@tanstack/react-router";

import { MISTAKE_CATEGORY_LABELS } from "./mistake-category-labels";
import "./vocabulary-prefill";

export const OccurrenceNote = ({
  evaluationId,
  index,
  occurrence,
}: {
  readonly evaluationId: string;
  readonly index: number;
  readonly occurrence: PracticeOccurrence;
}) => (
  <article
    className="border-border target:bg-linen grid scroll-mt-8 grid-cols-[2rem_minmax(0,1fr)] gap-x-3 border-t py-6"
    id={`note-${String(index)}`}
  >
    <span
      aria-label={`Mistake ${String(index + 1)}`}
      className="text-violet pt-0.5 font-mono text-sm"
    >
      {index + 1}
    </span>
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge
          variant={
            occurrence.severity === "ERROR" ? "destructive" : "secondary"
          }
        >
          {occurrence.severity === "ERROR" ? "Incorrect" : "Unnatural"}
        </Badge>
        <Badge variant="outline">
          {MISTAKE_CATEGORY_LABELS[occurrence.category]}
        </Badge>
        {occurrence.l1Transfer ? (
          <Badge variant="outline">From Portuguese</Badge>
        ) : null}
      </div>
      <p className="prose-serif text-xl leading-snug">
        <span className="text-muted-foreground line-through decoration-1">
          {occurrence.originalSpan}
        </span>{" "}
        <span aria-hidden="true">→</span>{" "}
        <span className="sr-only">corrected to</span>
        <span>{occurrence.correctedSpan}</span>
      </p>
      <p className="text-iron">{occurrence.explanation}</p>
      <p className="prose-serif text-iron italic">
        &ldquo;{occurrence.example}&rdquo;
      </p>
      <Link
        className="inline-block text-sm underline"
        state={{
          vocabularyPrefill: {
            example: occurrence.example,
            sourceEvaluationId: evaluationId,
            term: occurrence.correctedSpan,
          },
        }}
        to="/vocabulary"
      >
        Save to vocabulary
      </Link>
    </div>
  </article>
);

// The note for a Finding the Enrichment recorded no Occurrence for: its Error Category stands in
// for the Mistake Category, and it carries no example.
export const FindingNote = ({
  evaluationId,
  finding,
  index,
}: {
  readonly evaluationId: string;
  readonly finding: EvaluationFinding;
  readonly index: number;
}) => (
  <article
    className="border-border target:bg-linen grid scroll-mt-8 grid-cols-[2rem_minmax(0,1fr)] gap-x-3 border-t py-6"
    id={`note-${String(index)}`}
  >
    <span
      aria-label={`Mistake ${String(index + 1)}`}
      className="text-violet pt-0.5 font-mono text-sm"
    >
      {index + 1}
    </span>
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="destructive">Incorrect</Badge>
        <Badge variant="outline">{finding.category}</Badge>
      </div>
      <p className="prose-serif text-xl leading-snug">
        <span className="text-muted-foreground line-through decoration-1">
          {finding.originalText}
        </span>{" "}
        <span aria-hidden="true">→</span>{" "}
        <span className="sr-only">corrected to</span>
        <span>{finding.correction}</span>
      </p>
      <p className="text-iron">{finding.explanation}</p>
      <Link
        className="inline-block text-sm underline"
        state={{
          vocabularyPrefill: {
            example: "",
            sourceEvaluationId: evaluationId,
            term: finding.correction,
          },
        }}
        to="/vocabulary"
      >
        Save to vocabulary
      </Link>
    </div>
  </article>
);
