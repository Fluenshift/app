# 0014. A mistake repeated in real text counts as a failed recall

- Status: Proposed. Decided on {issue}; accepted when both owners accept it there.
- Open item from PRE_MIGRATION. Its rows wait on ADR 0004, which feeds the Academy.

## Context

Grifando demotes a pattern's mastery when the learner makes the mistake again in analyzed
writing: "Making the mistake again is a failed recall" (`writingCoachService.ts:97-105`,
SPEC §6). In the merged product, Findings come from Evaluations of work-origin and
practice-origin samples.

## Decision

A Finding that the enrichment maps to an existing Mistake Pattern counts as a failed recall,
whatever the sample's origin. The Evaluation never mentions mastery; the Academy shows the
practice state with the real-text evidence beside it.

## Consequences

- Grifando's demotion rule `port`s, fed by Findings.

## Alternatives

- Count only practice-origin samples: real mistakes would never cost mastery.
