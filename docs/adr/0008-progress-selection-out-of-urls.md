# 0008. Keep the Progress drill-down selection out of URLs

- Status: Proposed. Decided on {issue}; accepted when both owners accept it there.
- Seam: Phase 1 (g). Ledger rows: `decision: "adr:0008"`.

## Context

PE's Progress drill-down sends `originalText` and `correction` as query parameters
(`apps/web/src/features/evaluations/http-evaluation-client.ts:66-68`,
`apps/server/src/app.ts:133-139`). PRE_MIGRATION's agent rules forbid user text in URLs or
query strings, because loggers record URLs.

## Decision

Evidence for a selected Correction or summary is requested with `POST /api/progress/evidence`,
the selection in the JSON body. URLs keep only the period and non-text identifiers such as an
Error Category. A G7 test asserts that no route reads user text from a URL or query string.

## Consequences

- Rows `adr:0008` become `port-changed`: same evidence, new transport.

## Alternatives

- An opaque server-issued selection key in the URL: shareable links, but one more stored entity.
