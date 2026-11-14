# Architecture decision records

Each ADR decides one seam or open question of the merge (`docs/migration/MIGRATION_PROTOCOL.md`
Phase 1). An ADR is **Proposed** until both owners accept it on its decision issue ([#5](https://github.com/Fluenshift/app/issues/5) for 0001 to 0018); its
status line then links to the acceptance comments. Only an accepted ADR can make a ledger row
`port-changed`, `superseded` or `drop`. Ledger rows that wait on one name it as
`"decision": "adr:NNNN"`.

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](./0001-amend-the-migration-protocol.md) | Amend the protocol: informative rows, characterization scope, code reuse, roles, batched acceptance, ruleset, gate self-tests | Proposed |
| [0002](./0002-score-evaluations-locally.md) | One locally derived score; no model-supplied scores | Proposed |
| [0003](./0003-tenancy-and-deploy-profiles.md) | Learner on every table; `local` profile first, `hosted` profile in Phase 6 | Proposed |
| [0004](./0004-writing-analysis-becomes-evaluation.md) | Grifando's analysis becomes Evaluation plus Trainer enrichment; spans by offset | Proposed |
| [0005](./0005-map-grifando-categories.md) | Grifando's 13 categories map onto PE's 9 | Proposed |
| [0006](./0006-input-caps-per-profile.md) | PE's caps locally, Grifando's caps when hosted | Proposed |
| [0007](./0007-effect-schema-in-the-web-app.md) | Effect Schema shared with the web through `packages/contract` | Proposed |
| [0008](./0008-progress-selection-out-of-urls.md) | Progress evidence selection in a POST body, never in a URL | Proposed |
| [0009](./0009-design-language-and-fonts.md) | Grifando's visual system with PE's Evidence Lens layout | Proposed |
| [0010](./0010-interview-scoring.md) | Interview answers are practice Writing Samples; no fifth score | Proposed |
| [0011](./0011-cleanup-scheduling.md) | Hosted cleanup runs in process on a daily schedule | Proposed |
| [0012](./0012-judge-and-trainer-providers.md) | Judge pinned on OpenRouter; Trainer on any provider; keys per profile | Proposed |
| [0013](./0013-no-remote-analytics.md) | No remote telemetry or analytics | Proposed |
| [0014](./0014-mistakes-in-real-text-cost-mastery.md) | A mistake repeated in real text is a failed recall | Proposed |
| [0015](./0015-academy-state-across-rubric-versions.md) | Academy state spans Rubric Versions | Proposed |
| [0016](./0016-practice-is-offered.md) | Practice is offered, never imposed | Proposed |
| [0017](./0017-postgres-and-pglite.md) | Postgres when hosted, PGlite locally and in tests | Proposed |
| [0018](./0018-data-at-cutover.md) | Grifando starts fresh with notice; PE history is imported | Proposed |
