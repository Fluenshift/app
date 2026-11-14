# 0002. Score Evaluations locally; drop model-supplied scores

- Status: Proposed. Decided on [#5](https://github.com/Fluenshift/app/issues/5); accepted when both owners accept it there.
- Seam: Phase 1 (a). Ledger rows: `decision: "adr:0002"`.

## Context

- PE derives the Overall Score from Findings: "The score is derived locally, never supplied by
  the model" (`docs/product/RUBRIC.md`, Score and bands).
- Grifando asks the model for four 0 to 100 scores, grammar, vocabulary, clarity and
  naturalness, plus `technicalCommunication` for interviews
  (`src/server/ai/schemas/writingAnalysis.ts:27-35`, SPEC §5.1), and averages them on the
  dashboard (`computeAverageScores` in `src/server/domain/progress/progress.ts`, SPEC §5.9).
- Model-supplied scores are not reproducible and cannot be calibrated.

## Decision

Each Evaluation has one score: PE's locally derived Overall Score with its Proficiency Band.
Model-supplied dimension scores are neither requested nor stored. Academy progress uses
Finding-based measures (Finding Rate, Category Recurrence) and practice state (mastery,
streak), never averaged model scores.

## Consequences

- Rows `adr:0002`: Grifando's score averages and the score part of the dashboard become
  `superseded`.
- Interview scoring follows ADR 0010.

## Alternatives

- Keep the four scores as an Academy-only "model opinion": cheap, but it puts
  non-reproducible numbers next to the rubric score.
