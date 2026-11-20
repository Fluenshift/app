# Architecture decision records

Each ADR records one decision of the merge. Since ADR 0020 the session that decides writes the
ADR, and it is in force once its pull request merges; its status line says when, and at whose
request. Only an ADR can make a ledger row `port-changed`, `superseded` or `drop`, and such a row
names it as `"decision": "adr:NNNN"`.

Jhefferson accepted 0001 to 0018 on 2026-11-14 ([comment](https://github.com/Fluenshift/app/issues/5#issuecomment-6880924859)) and 0019 on 2026-11-16.

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
| [0020](./0020-sessions-decide.md) | Sessions decide and merge; the open owner requests are decided | Accepted |
| [0021](./0021-rows-built-before-their-tests.md) | A row whose behavior an earlier unit built is superseded by its ported tests | Accepted |
| [0022](./0022-document-clauses-live-in-the-merged-documents.md) | Document-clause rows are superseded by the merged documents | Accepted |
| [0023](./0023-academy-record-ids-in-paths.md) | The IDs of the Academy's records may travel in URL paths | Accepted |
| [0024](./0024-interview-answer-failures.md) | An interview answer fails as the Evaluation route or as Grifando's FAILED session | Accepted |
| [0025](./0025-academy-pages.md) | Each Academy page ports as a Hono read and an SPA route; the Academy dashboard moves to `/academy` | Accepted |
| [0026](./0026-practice-writing.md) | Practice writing's route and results; Academy routes log an unexpected failure by its tag or name only | Accepted |
| [0027](./0027-academy-finding-trend.md) | The Academy dashboard's trend: the Finding Rate of the last 10 practice Writing Samples, with counts and no direction | Accepted |
| [0028](./0028-naturalness-notes.md) | The Enrichment adds the natural version and the Naturalness Notes on every folded Evaluation; a note grows its pattern without a recall | Accepted |
| [0029](./0029-layout-and-motion-fixes.md) | Grifando's layout and motion fixes have no test target: the spacing roles are informative, the reveal and count-up fix is dropped | Accepted |
| [0030](./0030-progress-without-practice.md) | Progress leaves practice-origin Writing Samples out of every insight and its evidence, with no switch, and says so | Accepted |
| [0031](./0031-deleting-an-evaluation-rebuilds-its-patterns.md) | Deleting an Evaluation rebuilds the Mistake Patterns it touched from what remains, and removes a pattern left without an Occurrence; practice stays | Accepted |
| [0032](./0032-hosted-request-pipeline.md) | The hosted session gate mints the cookie on the application shell and refuses sessionless API requests but the health check; a static CSP with Grifando's security headers; no Origin check; `SESSION_SECRET` required in production | Accepted |
