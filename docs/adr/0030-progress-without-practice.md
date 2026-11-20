# 0030. Progress leaves practice writing out of every insight

- Status: Accepted on 2026-11-20 by the session (ADR 0020).
- Phase 5f. Decides how far ADR 0010's "practice-origin samples stay out of Finding Rate by
  default" reaches. No ledger row changes: PE has no practice origin and Grifando no Finding Rate.

## Context

- ADR 0010 makes each interview answer a practice-origin Writing Sample and keeps such samples
  out of Finding Rate by default. `RUBRIC.md` (Progress Insights) repeats it on the Finding Rate
  alone, and `CONTEXT.md` (Progress Insight) on "the finding rate".
- Progress shows the Finding Rate with the Evaluation, word and Finding counts it divides, beside
  Category Recurrence, the average score, the distribution by category and the recurring
  Corrections, and every insight opens its exact source Findings (FR-18 to FR-21). All of them
  read one set of Evaluations, and Progress counted every origin.
- Practice writing answers the Academy's prompts, which aim at the Learner's own Mistake Patterns
  and weak categories. The Academy shows its own trend over practice samples (ADR 0027).

## Decision

1. Every Progress Insight and its evidence read the Evaluations of work-origin Writing Samples
   only: the Finding Rate and its counts, Category Recurrence, the average score, the
   distribution and the recurring Corrections.
2. No setting adds practice samples back. Learning History still lists every Evaluation, and the
   Academy's trend reads practice (ADR 0027).
3. The Progress page says so in its period summary: "Academy practice is not counted."

## Consequences

- The counts beside the Finding Rate stay the ones it divides, and each insight's evidence holds
  only the Evaluations it counted.
- A Learner who only practices in the Academy sees Progress's empty state.
- `RUBRIC.md` and `CONTEXT.md` state the rule for every insight.

## Alternatives

- Leave practice out of the Finding Rate alone: its counts would disagree with Category
  Recurrence and the average score on the same page, and the evidence would need two sets.
- A switch that adds practice back: no requirement asks for one, and the Academy's trend already
  shows practice.
