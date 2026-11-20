# 0027. The Academy dashboard's Finding-based trend

- Status: Accepted on 2026-11-20 by the session (ADR 0020).
- Phase 5e. Decides AR-17's "one Finding-based trend". No ledger row changes.

## Context

- Grifando's dashboard averaged the four model scores of the last 10 analyzed writing sessions
  (`computeAverageScores`, `SCORE_TREND_LIMIT` in `src/app/page.tsx`, 74dbb9f). ADR 0002 removed
  those scores and named Finding Rate and Category Recurrence as the Academy's measures of
  progress, and #163 ported the dashboard without the averages.
- `RUBRIC.md` defines Finding Rate as `Findings / evaluated English words × 100`, always shown
  with its Evaluation, word and Finding counts, and never merged across incompatible Rubric
  Versions (FR-22). Practice-origin Writing Samples stay out of Progress's default finding rate
  (ADR 0010).
- `REQUIREMENTS.md` keeps directional improvement claims out of scope.

## Decision

1. The trend is the Finding Rate of each of the Learner's last 10 practice-origin Writing
   Samples under the current Rubric Version, oldest first, and the rate of those samples
   together, each with its counts. It is the Academy's measure of practice, in the place of
   Grifando's averages over its last 10 sessions, and leaves Progress's default untouched.
2. Samples of other Rubric Versions stay out of it; the Academy's practice state still spans
   versions (ADR 0015).
3. The card shows values and counts only: no word, arrow or color says that the rate improves or
   worsens.

## Consequences

- `GET /api/academy/dashboard` answers a `findingTrend`, and the dashboard's progress card shows
  it where Grifando showed the averages, with an empty text before the first practice sample.

## Alternatives

- Progress's own 30-day Finding Rate: once 5f lands it leaves practice samples out, which is
  what the Academy measures.
- One rate for the window without the samples: a value, not a trend.
