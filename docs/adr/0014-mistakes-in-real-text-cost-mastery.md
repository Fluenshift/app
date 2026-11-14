# 0014. A mistake repeated in real text counts as a failed recall

- Status: Accepted by Jhefferson on 2026-11-14 ([comment](https://github.com/Fluenshift/app/issues/5#issuecomment-6880924859)) on [#5](https://github.com/Fluenshift/app/issues/5). Levy's acceptance is pending; the migration proceeds meanwhile.
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
