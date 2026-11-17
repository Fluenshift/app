# 0023. Academy record IDs in URL paths

- Status: Accepted on 2026-11-17 by the session (ADR 0020).
- Amends ADR 0008. No ledger row changes.

## Context

ADR 0008 keeps user text out of URLs, because loggers record them: a query string carries only
the period, the insight and the Error Category, and a path only the Evaluation ID. Gate G7,
`scripts/check-url-text.ts`, enforces that list. Grifando's Academy routes name the record they
act on in the path: `/api/vocabulary/[id]`, `/api/exercises/[id]/attempts/[attemptId]` and
`/api/interview/[id]/turns/[turnId]`.

## Decision

A path may also carry the IDs of the Academy's records: `itemId` (a vocabulary item),
`exerciseId`, `attemptId`, `sessionId` (an interview session) and `turnId`. The server
generates each of them as a random UUID, so none holds anything a Learner wrote. G7 accepts
these names and still refuses any other.

## Consequences

- The Academy routes port Grifando's paths with named parameters, for example
  `DELETE /api/vocabulary/:itemId`.
- Text a Learner wrote still never travels in a URL.
