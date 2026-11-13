# 0016. Offer practice; never impose it

- Status: Proposed. Decided on [#5](https://github.com/Fluenshift/app/issues/5); accepted when both owners accept it there.
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
