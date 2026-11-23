# Spec: Progress charts

- Status: Draft, 2026-11-23. Answers #320 ("Charts over the stored results").
- Depends on: [Text Kinds](./2026-11-23-text-kinds.md) for the per-kind view (TK-07). The trend
  chart can ship first.

## Why

The product stores every Evaluation so the Learner can "see charts and trends" later (#320).
Today Progress shows one aggregate per period: Finding Rate, average score, category counts and
recurring corrections. It answers "how am I doing?" but not "am I getting better?".

## Goals

1. A trend of Finding Rate over time, the primary measure (FR-18, FR-21).
2. Error Categories over time, so a Learner sees which mistakes are fading and which stay.
3. With Text Kinds, the same views per kind and a comparison between kinds.
4. Every point on a chart opens its evidence, as every Progress Insight already does (FR-20).

## Non-goals

- Academy practice in these charts. Progress reads work Evaluations only (ADR 0030); the
  Academy has its own trend (ADR 0027).
- Streak, goals or any game element (Jhefferson's area).
- Remote analytics of any kind (ADR 0013).

## Anti-goals

- A chart that cannot be traced back to its rows. QR-02 holds: every value recomputes from
  retained Findings.
- Mixing Rubric Versions in one line (FR-22).
- Charts that say "improving" from two or three points. Small samples must look small.

## Requirements

New IDs in `docs/product/REQUIREMENTS.md`, range PC:

| ID | Requirement | Profiles |
| --- | --- | --- |
| PC-01 | Progress returns a time series per period: one bucket per calendar day for 7 and 30 days, per ISO week (Monday start) for all history, each with evaluation count, English word count, Finding count and Finding Rate. Days and weeks are in the time zone the browser sends (IANA name); without one, UTC. | both |
| PC-02 | Buckets with no Evaluations are returned empty, not as zero Finding Rate. | both |
| PC-03 | The series also carries Finding count per Error Category per bucket. | both |
| PC-04 | The series honors the Text Kind filter (TK-07) and stays within one Rubric Version. | both |
| PC-05 | Selecting a bucket opens the evidence of its Evaluations through the existing evidence route. | both |
| PC-06 | Each chart has a text equivalent (a table or a summary sentence) for screen readers, and colors are not the only way to tell series apart. | both |
| PC-07 | A trend with fewer than 3 non-empty buckets shows the points and says the sample is too small to read a trend. | both |
| PC-08 | Comparison by Text Kind shows Finding Rate per kind for the period, with each kind's evaluation count. | both |

## Where it lands

- `packages/contract/src/evaluation.ts`: a `ProgressSeries`, added to `ProgressSummary` as
  `series` for the current Rubric Version only (older versions in `incompatibleSegments` get no
  chart), and a `byKind` field for PC-08 that always lists every kind, whatever the filter.
- `apps/server/src/progress/progress-insights.ts`: the bucketing, next to the current
  aggregation, as pure functions with unit tests in `progress-insights.test.ts`. Today's periods
  are rolling windows (`now - N × 24h`); they stay so, and the first bucket may be partial.
- `GET /api/progress` gains optional `timeZone` and `textKind` query parameters. When
  `textKind` is set, everything in the summary is filtered by it except `byKind`.
- `ProgressEvidenceSelection` gains `{ kind: "bucket", from, to }` (ISO instants), on both the
  GET and POST evidence routes, beside the optional `textKind`.
- `apps/web/src/routes/progress.tsx` and a new `apps/web/src/features/progress/`: the charts in
  the centre column, above today's summary.

## Charts

- Finding Rate over time: a line with points; empty buckets break the line.
- Error Categories over time: stacked bars of Finding count per bucket, or small multiples per
  category; the builder picks the one that reads better at mobile width.
- By Text Kind: one horizontal bar per kind, labeled with its evaluation count.

## Left to the builder

- Chart rendering. Prefer inline SVG with the design tokens already in `packages/ui`; the
  product has no chart library today, and these three charts are simple. A library is an
  acceptable choice only with an ADR (ADR 0000, the approved stack).
- Exact layout within the current Progress page; the interface redesign (#333) may move it
  later, so keep the charts as self-contained components.

## Acceptance

- Unit tests for bucketing: empty buckets, a bucket spanning midnight, two Rubric Versions,
  the kind filter.
- Playwright: with seeded Evaluations over 10 days, the 30-day chart shows the right points and
  clicking one lists its Evaluations.
- Light and dark themes render the charts legibly (`-root.light-theme.test.tsx` pattern).

## Approaches considered

1. **Server returns the series, web draws SVG (chosen).** Keeps QR-02 in one tested place,
   the same module that computes today's aggregates (`apps/server/src/progress/`).
2. Web computes the series from the Evaluation list. No API change, but duplicates rules that
   `core` owns and breaks with pagination.
3. Add a chart library. Faster to draw, but a new dependency and bundle size for three charts.
