# 0015. Keep Academy state across Rubric Versions

- Status: Accepted by Jhefferson on 2026-11-14 ([comment](https://github.com/Fluenshift/app/issues/5#issuecomment-6880924859)) on [#5](https://github.com/Fluenshift/app/issues/5). Levy's acceptance is pending; the migration proceeds meanwhile.
- Open item from PRE_MIGRATION.

## Context

Progress never merges incompatible Rubric Versions (RUBRIC.md). The Judge moves to a
provisional Rubric Version (ADR 0012) while learners keep their Mistake Patterns.

## Decision

Mistake Patterns, mastery and recall span Rubric Versions: they describe practice, not
measurement. Each Occurrence records the Rubric Version of its Finding. Progress on the
Evaluation axis still segments by Rubric Version.

## Consequences

- No ledger row changes; the Academy schema stores the Rubric Version per Occurrence.

## Alternatives

- Reset patterns per Rubric Version: learners lose their practice history at every Judge
  change.
