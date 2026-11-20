// A practice Writing Sample's results. Ported from Grifando
// src/components/writing/WritingResults.tsx (74dbb9f) onto its Evaluation (docs/adr/0026): PE's
// localized marks replace Grifando's highlights (docs/adr/0004), the Overall Score and its band
// replace the four model scores (docs/adr/0002), and the natural version comes from the
// Enrichment (docs/adr/0028).
import type {
  Evaluation,
  EvaluationFinding,
  PracticeOccurrence,
} from "@fluenshift/contract";
import { Button } from "@fluenshift/ui/components/button";
import { Link } from "@tanstack/react-router";

import { SpellChecker } from "../evaluations/spell-checker";
import { FindingNote, MistakeCard } from "./mistake-card";

export const WritingResults = ({
  evaluation,
  naturalVersion,
  nextStep,
  occurrences,
  onWriteAnother,
}: {
  readonly evaluation: Evaluation;
  // How a fluent speaker might phrase the text; null when the Enrichment recorded none.
  readonly naturalVersion: string | null;
  // Extra primary action after the results (e.g. the daily session's review step).
  readonly nextStep?: { readonly label: string; readonly onClick: () => void };
  readonly occurrences: readonly PracticeOccurrence[];
  readonly onWriteAnother: () => void;
}) => {
  const markCount = evaluation.findings.length;
  // One note per Finding, from its Occurrence when the Enrichment recorded one (Clarity and Other
  // take no Mistake Category), then the Naturalness Notes, which have no Finding.
  const notes: readonly (
    | { readonly occurrence: PracticeOccurrence }
    | { readonly finding: EvaluationFinding; readonly position: number }
  )[] = [
    ...evaluation.findings.map((finding, position) => {
      const occurrence = occurrences.find(
        (candidate) => candidate.findingPosition === position
      );
      return occurrence === undefined ? { finding, position } : { occurrence };
    }),
    ...occurrences
      .filter((occurrence) => occurrence.findingPosition === null)
      .map((occurrence) => ({ occurrence })),
  ];

  return (
    <div className="space-y-20">
      <div className="grid gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section aria-labelledby="proof-title" className="space-y-6">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="text-heading" id="proof-title">
              Your writing
            </h2>
            <span className="label-mono text-muted-foreground">
              {markCount === 0
                ? "No marks"
                : `${String(markCount)} mark${markCount === 1 ? "" : "s"}`}
            </span>
          </div>
          <div className="rounded-card bg-card ring-border p-6 ring-1 md:p-10">
            <SpellChecker
              findings={evaluation.findings}
              readOnly={true}
              suggestions={evaluation.suggestions}
              text={evaluation.originalText}
            />
          </div>
          <p className="prose-serif text-iron text-lg">{evaluation.summary}</p>
        </section>

        <section aria-labelledby="notes-title">
          <h2 className="text-heading mb-6" id="notes-title">
            Notes
          </h2>
          {notes.length > 0 ? (
            <div className="border-border border-b">
              {notes.map((note, index) =>
                "occurrence" in note ? (
                  <MistakeCard
                    evaluationId={evaluation.id}
                    index={index}
                    key={note.occurrence.id}
                    mistake={note.occurrence}
                  />
                ) : (
                  <FindingNote
                    evaluationId={evaluation.id}
                    finding={note.finding}
                    index={index}
                    key={`finding-${String(note.position)}`}
                  />
                )
              )}
            </div>
          ) : (
            <p className="prose-serif text-iron text-lg">
              Nothing to correct here — clean, natural English.
            </p>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          aria-labelledby="corrected-title"
          className="rounded-card bg-linen space-y-4 p-6 md:p-10"
        >
          <h2 className="text-heading-sm" id="corrected-title">
            Corrected version
          </h2>
          <p className="prose-serif text-lg leading-relaxed whitespace-pre-wrap">
            {evaluation.correctedText}
          </p>
        </section>
        {naturalVersion === null ? null : (
          <section
            aria-labelledby="natural-title"
            className="rounded-card bg-linen space-y-4 p-6 md:p-10"
          >
            <h2 className="text-heading-sm" id="natural-title">
              Natural version
            </h2>
            <p className="text-muted-foreground text-sm">
              How a fluent speaker might phrase the same idea — one option, not
              the only correct way to say it.
            </p>
            <p className="prose-serif text-lg leading-relaxed whitespace-pre-wrap">
              {naturalVersion}
            </p>
          </section>
        )}
        <section
          aria-labelledby="score-title"
          className="rounded-card bg-linen space-y-4 p-6 md:p-10"
        >
          <h2 className="text-heading-sm" id="score-title">
            Score
          </h2>
          <p className="text-display tabular-nums">{evaluation.score}</p>
          <p className="text-iron">{evaluation.band}</p>
          <Link
            className="text-sm underline"
            params={{ evaluationId: evaluation.id }}
            to="/evaluations/$evaluationId"
          >
            Open the Evaluation
          </Link>
        </section>
      </div>

      <div className="flex flex-wrap gap-2">
        {nextStep === undefined ? null : (
          <Button
            onClick={() => {
              nextStep.onClick();
            }}
          >
            {nextStep.label}
          </Button>
        )}
        <Button
          onClick={onWriteAnother}
          variant={nextStep === undefined ? "default" : "ghost"}
        >
          Write something else
        </Button>
      </div>
    </div>
  );
};
