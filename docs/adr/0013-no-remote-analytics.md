# 0013. Collect no remote telemetry or analytics

- Status: Proposed. Decided on [#5](https://github.com/Fluenshift/app/issues/5); accepted when both owners accept it there.
- Open item from PRE_MIGRATION (analytics). Ledger rows: `decision: "adr:0013"`.

## Context

Grifando loads Vercel Analytics (`src/app/layout.tsx:4`). PE's data policy forbids remote
telemetry and analytics (`docs/product/DATA-POLICY.md`).

## Decision

Neither profile sends telemetry or analytics. Vercel Analytics is dropped. Adding any later
requires a new ADR and a data-policy change.

## Consequences

- Rows `adr:0013` become `port` in both profiles.

## Alternatives

- Privacy-preserving, self-hosted page counts in the hosted profile only.
