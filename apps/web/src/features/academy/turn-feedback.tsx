// The feedback on one answered interview turn. Ported from Grifando
// src/components/interview/TurnFeedback.tsx (74dbb9f) onto the answer's Evaluation
// (docs/adr/0010): its summary, its corrected version when it differs from the answer, Grifando's
// natural version when it differs from the answer (docs/adr/0028), and the Overall Score with its
// band in place of Grifando's five model scores.
import type { Evaluation, InterviewTurnRef } from "@grifando/contract";

export interface CompletedTurn {
  readonly answer: string;
  readonly evaluation: Evaluation;
  // How a fluent speaker might phrase the answer; null when the Enrichment recorded none.
  readonly naturalVersion: string | null;
  readonly question: InterviewTurnRef["question"];
}

export const TurnFeedback = ({
  index,
  turn,
}: {
  readonly index: number;
  readonly turn: CompletedTurn;
}) => {
  const { evaluation } = turn;
  const titleId = `turn-${String(index)}-question`;

  return (
    <section
      aria-labelledby={titleId}
      className="grid gap-x-16 gap-y-6 lg:grid-cols-[340px_minmax(0,1fr)]"
    >
      <div className="space-y-3">
        <p className="label-mono text-muted-foreground">Question {index + 1}</p>
        <h2 className="text-heading-sm" id={titleId}>
          {turn.question}
        </h2>
      </div>
      <div className="space-y-6">
        <p className="prose-serif rounded-card bg-card ring-border p-6 text-lg ring-1 md:p-8">
          {turn.answer}
        </p>
        <p className="text-iron">{evaluation.summary}</p>
        {evaluation.correctedText === turn.answer ? null : (
          <div className="rounded-card bg-linen space-y-2 p-6 md:p-8">
            <p className="label-mono text-muted-foreground">
              Corrected version
            </p>
            <p className="prose-serif text-lg">{evaluation.correctedText}</p>
          </div>
        )}
        {turn.naturalVersion === null ||
        turn.naturalVersion === turn.answer ? null : (
          <div className="rounded-card bg-linen space-y-2 p-6 md:p-8">
            <p className="label-mono text-muted-foreground">More naturally</p>
            <p className="prose-serif text-lg">{turn.naturalVersion}</p>
          </div>
        )}
        <div className="space-y-1">
          <p className="text-display tabular-nums">{evaluation.score}</p>
          <p className="text-iron">{evaluation.band}</p>
        </div>
      </div>
    </section>
  );
};
