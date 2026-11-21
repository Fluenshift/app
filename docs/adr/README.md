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
| [0031](./0031-deleting-an-evaluation-rebuilds-its-patterns.md) | Deleting an Evaluation rebuilds the Mistake Patterns it touched from what remains, and removes a pattern left without an Occurrence; Exercises and Attempts stay | Accepted |
| [0032](./0032-hosted-request-pipeline.md) | The hosted session gate mints the cookie on the application shell and refuses sessionless API requests but the health check; a static CSP with Grifando's security headers; no Origin check; `SESSION_SECRET` required in production | Accepted |
| [0033](./0033-hosted-rate-limits.md) | Grifando's rate limits in the hosted profile only, counted after a route's body and key checks and before `ensureLearner`; PE's Evaluation counts as analysis, its deletion as a write; `CLIENT_IP_HEADER` names the client IP's header; `IP_HASH_SALT` required in production | Accepted |
| [0034](./0034-the-spa-reads-its-deploy-profile.md) | The SPA reads its Deploy Profile from `GET /api/deploy-profile` at startup; in the hosted profile the Trainer calls and the key test carry the browser's AI key and `/settings` holds Grifando's key page, which the local profile redirects to `/setup` | Accepted |
| [0035](./0035-the-hosted-judge-runs-on-the-visitors-key.md) | The hosted Judge runs only on the visitor's OpenRouter key, which the browser's one key may be and which also runs the Trainer; without one a hosted Judge call answers `AI_JUDGE_KEY_REQUIRED`; only the local profile reads `OPENROUTER_API_KEY` | Accepted |
| [0036](./0036-the-hosted-privacy-page.md) | The hosted profile's `/privacy` ports Grifando's page and its "Delete my data" button, its copy corrected where Grifando's facts changed; the hosted profile redirects `/setup` to it and links "Key settings" and "Privacy" in place of "Setup & privacy"; the local profile redirects `/privacy` to `/setup`; Grifando's footer does not port | Accepted |
| [0037](./0037-robots-and-sitemap.md) | The hosted profile answers `robots.txt` and `sitemap.xml` itself, at the origin `SITE_URL` names (`http://localhost:3000` when unset, no Vercel fallback), and its session gate mints no cookie on them; the local profile serves neither | Accepted |
| [0038](./0038-explain-code.md) | Explain code is practice writing with a snippet only the Trainer receives: trimmed, never blank, within the profile's code cap at the edge and in the service; `SampleLimits` gains the code cap; the Academy navigation lists Explain code | Accepted |
| [0039](./0039-focus-music.md) | Grifando's Focus Music sits in the header of both profiles, so the music survives navigation; its player's frame is sandboxed with the narrowest set Spotify and YouTube play in, which lint admits for that one file | Accepted |
| [0040](./0040-link-preview.md) | No page is prerendered; the shell carries Grifando's metadata with Fluenshift's name, static at build; Grifando's Open Graph card, renamed, is a committed static file that the hosted server names at `SITE_URL` and serves outside the session | Accepted |
| [0041](./0041-work-evaluations-feed-the-academy.md) | Once the Learner has a practice-origin Evaluation, the Writing Desk folds each Evaluation it stores on the request's Trainer, before it answers; with no Trainer key it does not; a failed fold keeps the Evaluation and its answer and logs one line | Accepted |
| [0042](./0042-routes-check-their-bodies-with-the-contract.md) | Each route reads its JSON body after its own first checks, checks it with its contract schema and declares it to Hono's typed client from that schema, in place of `@hono/standard-validator`; every request schema lives in the contract; the unused validator and `@ai-sdk/openai` pins leave the catalog | Accepted |
| [0043](./0043-the-end-to-end-pause-ends.md) | The end-to-end pause ends: rows that check the server, its container and its data port; the ten that check the interface (PE's browser journey and Vite dev-proxy cases, Grifando's browser checks after a deploy) drop, since the owners expect to redesign it | Accepted |
