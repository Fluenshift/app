# Architecture decision records

Each ADR decides one seam or open question of the merge. An ADR is **Proposed** until an owner accepts it on its decision issue ([#5](https://github.com/Fluenshift/app/issues/5) for 0001 to 0018, [#117](https://github.com/Fluenshift/app/issues/117) for 0019); its
status line then links to the acceptance comment. Only an accepted ADR can make a ledger row
`port-changed`, `superseded` or `drop`, and such a row names it as `"decision": "adr:NNNN"`.

Jhefferson accepted 0001 to 0018 on 2026-11-14 ([comment](https://github.com/Fluenshift/app/issues/5#issuecomment-6880924859)). Levy's acceptance is
pending, and the migration proceeds meanwhile: an ADR that Levy decides differently is replaced
by a new ADR, and its rows are reworked.

ADRs 0001 to 0018 cite `docs/migration/PRE_MIGRATION.md` and `docs/migration/HANDOFF.md`, which
ADR 0019 deleted; commit `39fbb46` holds them.

| ADR | Decision | Status |
| --- | --- | --- |
| [0000](./0000-approved-stack.md) | The approved stack, the alternatives and when to revisit them | Recorded from `PRE_MIGRATION.md` |
| [0001](./0001-amend-the-migration-protocol.md) | Amend the protocol: informative rows, characterization scope, code reuse, roles, batched acceptance, ruleset, gate self-tests | Accepted |
| [0002](./0002-score-evaluations-locally.md) | One locally derived score; no model-supplied scores | Accepted |
| [0003](./0003-tenancy-and-deploy-profiles.md) | Learner on every table; `local` profile first, `hosted` profile in Phase 6 | Accepted |
| [0004](./0004-writing-analysis-becomes-evaluation.md) | Grifando's analysis becomes Evaluation plus Trainer enrichment; spans by offset | Accepted |
| [0005](./0005-map-grifando-categories.md) | Grifando's 13 categories map onto PE's 9 | Accepted |
| [0006](./0006-input-caps-per-profile.md) | PE's caps locally, Grifando's caps when hosted | Accepted |
| [0007](./0007-effect-schema-in-the-web-app.md) | Effect Schema shared with the web through `packages/contract` | Accepted |
| [0008](./0008-progress-selection-out-of-urls.md) | Progress evidence selection in a POST body, never in a URL | Accepted |
| [0009](./0009-design-language-and-fonts.md) | Grifando's visual system with PE's Evidence Lens layout | Accepted |
| [0010](./0010-interview-scoring.md) | Interview answers are practice Writing Samples; no fifth score | Accepted |
| [0011](./0011-cleanup-scheduling.md) | Hosted cleanup runs in process on a daily schedule | Accepted |
| [0012](./0012-judge-and-trainer-providers.md) | Judge pinned on OpenRouter; Trainer on any provider; keys per profile | Accepted |
| [0013](./0013-no-remote-analytics.md) | No remote telemetry or analytics | Accepted |
| [0014](./0014-mistakes-in-real-text-cost-mastery.md) | A mistake repeated in real text is a failed recall | Accepted |
| [0015](./0015-academy-state-across-rubric-versions.md) | Academy state spans Rubric Versions | Accepted |
| [0016](./0016-practice-is-offered.md) | Practice is offered, never imposed | Accepted |
| [0017](./0017-postgres-and-pglite.md) | Postgres when hosted, PGlite locally and in tests | Accepted |
| [0018](./0018-data-at-cutover.md) | Grifando starts fresh with notice; PE history is imported | Accepted |
| [0019](./0019-lighter-gates-and-shorter-documents.md) | G12 retired; each suite once per CI run; rules once in `AGENTS.md`; documents cut to the work ahead | Accepted |
