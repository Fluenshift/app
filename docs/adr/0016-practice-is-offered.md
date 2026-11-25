# 0016. Offer practice; never impose it

- Status: Accepted by Jhefferson on 2026-11-14 ([comment](https://github.com/Fluenshift/grifando/issues/5#issuecomment-6880924859)) on [#5](https://github.com/Fluenshift/grifando/issues/5). Levy's acceptance is pending; the migration proceeds meanwhile.
- Open item from PRE_MIGRATION. Ledger rows: `decision: "adr:0016"`.

## Context

PRE_MIGRATION makes the Academy optional and the Evaluation usable alone. Grifando SPEC §3
("behavioral contract") requires the learner to write first and drives practice from their own
mistakes.

## Decision

The Evaluation works alone; practice is offered, never required. Inside the Academy,
Grifando's contract holds: the learner writes first, and exercises come from their own
mistakes.

## Consequences

- SPEC §3 becomes `port-changed` (the Academy is optional).

## Alternatives

- A guided mode that always follows an Evaluation with practice.
