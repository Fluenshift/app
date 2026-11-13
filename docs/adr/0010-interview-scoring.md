# 0010. Evaluate interview answers as practice Writing Samples

- Status: Proposed. Decided on {issue}; accepted when both owners accept it there.
- Seam: Phase 1 (i). Ledger rows: `decision: "adr:0010"`.

## Context

Grifando scores each interview answer through its Writing Coach pipeline, with a fifth
model-supplied score, `technicalCommunication` (SPEC §5.8; `interviewService.ts`).

## Decision

Each interview answer is a Writing Sample of practice origin, evaluated by the Judge like any
other: Findings, Overall Score, band. There is no fifth score (ADR 0002). The Trainer asks the
follow-up questions. Practice-origin samples stay out of Finding Rate by default.

## Consequences

- Rows `adr:0010` become `port-changed` (the turn flow and turn cap port; the scoring changes).

## Alternatives

- Keep `technicalCommunication` as a Trainer-only note, labeled as model opinion.
