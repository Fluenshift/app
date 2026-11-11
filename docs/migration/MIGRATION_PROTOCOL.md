# MIGRATION_PROTOCOL — Prompt Evolution + Grifando

How AI agents (Claude Code and Codex) carry out the merge. Read `HANDOFF.md` and
`PRE_MIGRATION.md` first: the handoff has the repository setup; PRE_MIGRATION has the
approved stack, the product direction and the agent rules. This file defines how the
migration runs, and supersedes the "Migration strategy" section of PRE_MIGRATION. During
setup all three files are copied unchanged into the new repo's `docs/migration/`.

Origin: an independent single-agent evaluation on 2026-11-10. It worked read-only on both
repositories and treated the earlier PRE_MIGRATION strategy as one hypothesis among others.
The main facts below were spot-checked afterwards (tracked files, page and test counts,
fix commits, spend log).

Revised 2026-11-10 for the organization layout in `HANDOFF.md` § Topology:
- both source repos move into the organization;
- the new repo pins the baselines by commit SHA instead of importing them;
- work units are GitHub Issues;
- GitHub's merge queue replaces the manual one;
- the ledger no longer stores status, and the cross-vendor verdict is bound to the PR head.

## Technique

**Ledger-driven, test-first port into a new neutral repository.** This is PRE_MIGRATION's
test-guided port, strengthened for a process where no human reviews code:

- frozen, tagged baselines of both systems;
- a machine-generated inventory of every source test case and every normative doc clause;
- a parity ledger, checked in CI, that gives each inventory row a disposition and target tests;
- characterization tests, run against the baselines, for behavior no test covers;
- ADRs written spec-first, but only at the seams, and accepted by both owners;
- red-green, assertion-preservation and gate-integrity checks;
- every unit verified by the other vendor (Claude Code verifies Codex and vice versa).

PE is the tooling template, not the base. Neither old repository is converted in place.

Why the plain test-guided port is not enough: Grifando's UI (11 pages, 4,134 lines of TSX)
has zero tests; about 20% of test lines are tied to SDKs or frameworks and must be rewritten;
and the seams where the merged product deliberately differs from both systems have no oracle.

## Repositories and baselines

One organization holds `<org>/prompt-evolution`, `<org>/grifando` and the new repo
(`HANDOFF.md` § Topology).

- Each source repo carries a `parity-baseline` tag under a tag ruleset. The new repo imports
  no source history.
- `docs/migration/baselines.json` pins each baseline: repository, tag and commit SHA. The pin
  is the authority. The tag only keeps the commit reachable on GitHub.
- `scripts/migration/baselines.ts` clones each source repo outside the new repo's working
  tree (default `../<product>-baselines/<system>`) and checks out the pinned commit. It fails
  if the remote tag no longer resolves to the pin. Agents and CI read and run sources only
  through it, in disposable worktrees of those clones. The source repos are public, so CI
  needs no token for them.
- Source repos are read-only for agents (agent rule 1). Agent tokens have no write access to
  them, and PE is archived once its pin is verified.

### Baseline bumps

A source repo may change after its baseline, within the policy chosen at setup (`HANDOFF.md`
step 3), for example through a production fix in Grifando. Such a change is ported like any
other behavior:

1. The source owner tags the new commit `parity-baseline-N` (N = 2, 3, …). The
   `parity-baseline*` ruleset covers it, and older tags stay.
2. The coordinator runs one unit that updates the pin, re-runs that baseline suite and
   regenerates its inventory.
3. The inventory diff drives the ledger:
   - new rows default to `port`;
   - rows whose source is gone become `pending-decision`;
   - rows whose source test changed are audited again.
4. The unit merges only with parity-check green. Rows whose source test did not change keep
   their targets.

## Calibration deferred

The owners decided on 2026-11-10 that the priority is getting the merged repo working.
Live calibration (G13) runs after parity, when the owners schedule it. Until it passes:

- G13 is not a merge gate, and Phase 4 exits without it.
- The new Judge runs under a provisional Rubric Version, recorded as uncalibrated, and
  Progress never merges it with Rubric Version 1.
- Before the first run, the owners set a new budget. The remaining $3 no longer fits a full
  30-call run (PE `.scratch/testing-spend.md`).

## Why — comparison

With no human review, the only reviewer is executable evidence. For each technique the
question is whether an agent's mistake becomes a failing check. H = strong, M = partial,
L = weak; in the Risk column, H means low risk.

| Technique | Agents right without review | Fidelity | Parity proof | Risk | Splits across agents |
| --- | --- | --- | --- | --- | --- |
| 1 Spec-first rebuild | L | L | L | M | H |
| 2a PE as base | M | M | M | L | L |
| 2b Grifando as base | L | L | L | L | L |
| 3 Test-guided port (as in PRE_MIGRATION) | M | M | M | M | H |
| 4 Strangler fig | M | M | M | L | M |
| 5 Direct code translation | L | M | L | M | H |
| **6 Ledger-driven test-first port** | **H** | **H** | **H** | **H** | **H** |

Test suites total 10,249 lines (PE 6,290 in 28 files, about 165 cases; Grifando 3,959 in
49 files, about 276 cases). By how they port:

- **Class A, about 51%, ports nearly verbatim**: PE server pure 844, PE web and E2E 2,462,
  Grifando pure 1,896.
- **Class B, about 30%, same assertions on new fixtures**: PE SQLite 1,754, Grifando
  Postgres 1,284.
- **Class C, about 20%, re-expressed as contract tests**: 2,009 lines tied to the openai,
  Anthropic and Gemini SDKs, Elysia, Bun and Next.

Verdicts:

1. **Spec-first rebuild — rejected as the main technique.** The prose has already drifted
   from the code in both systems (see Evidence), and edge cases live only in code and tests.
   The same agent would write tests and code from the same prose, so its mistakes would be
   self-consistent and pass every gate. Used only at the seams, where no existing behavior
   can be the oracle.
2. **2a PE as base — rejected as a repository strategy.** PE is closest to the target, but
   converting in place swaps nearly every server dependency at once (Bun → Node, Elysia →
   Hono, bun:sqlite → Postgres, openai → AI SDK, bun:test → Vitest, Effect RC → 4.1.2), so
   the repo stays red and the gates cannot act as reviewer. It also carries PE-only
   constraints (loopback only, no sessions, no learner scoping) and has no history worth
   keeping (3 commits, 30 of 31 server files untracked). Kept as the tooling template.
3. **2b Grifando as base — rejected.** Farthest from the target (Next.js App Router with
   Server Components reading repositories, Prisma, Zod, TS 5.9, ESLint, no Effect), so it
   means rewriting a live product; its UI has no tests; its model-supplied scores conflict
   with RUBRIC.md:119. The owners chose a separate new repo next to it in the organization
   (`HANDOFF.md` § Topology).
4. **3 Test-guided port as written — the right foundation, not enough alone.** Untested
   behavior is lost, class-C tests change meaning with no oracle, FR/SPEC-section mapping is
   too coarse, nothing stops weakened assertions, and parity is undefined at the seams.
   Adopted as the base of the chosen technique.
5. **4 Strangler fig — rejected.** Nothing to route between: PE is a localhost app with no
   traffic, Grifando is serverless on Vercel, and the merged data model differs from both.
   Kept idea: both old apps stay runnable at frozen baselines as oracles until sign-off.
6. **5 Direct translation — rejected as standalone.** Translating code and tests in one pass
   lets the same error land in both; it imports old architecture. Allowed only inside the
   work unit cycle for class-A pure modules, after the ported tests have failed first.

## Roles and work split

- **Owners** (Jhefferson and Levy) make product decisions (G14) and trigger paid
  calibration. They never review code.
- **Coordinator**: one session, from either vendor. Generates the inventory, creates and
  assigns unit issues, owns shared files, adds verified PRs to the merge queue, maintains the
  ledger. Implements no feature units; the other vendor verifies its PRs too.
- **Implementers**: one unit at a time each, in their own git worktree or sandbox clone, on
  a `wu/<issue>-<slug>` branch.
- **Verifiers**: started on demand, always from the vendor that did not implement the unit.

Default pairing (swappable):

- Claude Code implements the Evaluation lane (PE-derived: PE units of Phase 3, and 4b–4f)
  and verifies the Academy lane.
- Codex implements the Academy lane (Grifando-derived: Grifando units of Phase 3, Phases 5
  and 6) and verifies the Evaluation lane.
- Web units of a slice can go to either vendor, as long as the verifier is the other one.

Concurrency:

- Phase 0: two sessions, one per system.
- Phase 1: one documentation session working with the owners.
- Phase 2: the coordinator alone, plus a verifier.
- Phase 3: up to four parallel units (PE protected-content; PE utf8, rubric and localization;
  Grifando recall, mastery, difficulty and selection; Grifando streak, patternKey, answer
  checking and diff).
- Phase 4: 4a serial, then 4b–4e in parallel, then 4f serial.
- Phase 5: 5a serial, then 5b–5e in parallel, then 5f last.
- Phase 6: modes in parallel; the hosted request pipeline (session, rate limit, CSP) as one
  serial unit.

The useful ceiling is about four implementers, one coordinator and verifiers on demand.

Conflict control: ledger files and contract modules are split per slice; only the
coordinator generates migrations, on a rebased main; GitHub's merge queue tests each PR merged
onto the latest main, with build concurrency 1; a PGlite database per test file lifts
Grifando's `fileParallelism: false`.

## Phases

### Phase 0 — Freeze baselines and build the inventory

Goal: turn both systems into immutable, runnable references and enumerate, by machine,
everything they do.

1. **Owner actions** (exact commands in `HANDOFF.md`).
   - The owners move both source repos into the organization and tag each baseline
     `parity-baseline`, under a tag ruleset.
   - The agent resolves both tags with `git ls-remote` and writes the pins to
     `docs/migration/baselines.json`. It records toolchains and run commands in
     `docs/migration/BASELINES.md`. PE uses Bun 1.4.0 (from `mise.toml`). Grifando uses
     Node 24.x, pnpm 12.3.4 and Postgres 17 (from `.nvmrc`, `package.json` and
     `.github/workflows/ci.yml`).
   - Nothing else starts before both pins exist.
2. Read and run the baselines only through `scripts/migration/baselines.ts` (see
   Repositories and baselines), in disposable worktrees outside the new repo's working tree.
   Phase 0 scripts run on plain Node 26 (type stripping) with no dependencies; anything that
   needs packages waits for Phase 2.
3. Run each baseline suite once with machine-readable reporters and store the reports in
   `docs/migration/baseline-runs/`:
   - PE: `bun test --reporter=junit` for server and db, Vitest `--reporter=json` for web and
     env, Playwright `--reporter=json` for E2E;
   - Grifando: Vitest `--reporter=json` against Postgres 17, after `pnpm db:test:prepare`.

   Mark any red test `baseline-red` and open a `needs-info` issue for it. It cannot serve as
   spec until the owners decide.
4. Generate the inventory with `scripts/migration/inventory.ts` into
   `docs/migration/inventory/{pe,grifando}.json`. Take test cases from the step 3 reports, so
   `.each` rows and skipped tests count the way the runner sees them. Sort rows by file and
   full title, so the output is deterministic. Include:
   - every test case by file and full title;
   - every PE FR/QR ID, and every RUBRIC.md and DATA-POLICY.md rule;
   - every Grifando SPEC.md subsection;
   - every CLAUDE.md bullet under "Architecture rules" and "Public deployment model";
   - every `docs/deploy.md` §5 smoke item, and every check in PE `scripts/docker-smoke.ts`;
   - every bug-fix commit in Grifando's history;
   - every Grifando GitHub issue (33 on 2026-11-10, in Portuguese), read from a one-time
     `gh issue list --state all` export stored in `docs/migration/inventory/`.
5. Classify each source test case as A (pure), B (persistence-bound, same assertions on
   PGlite) or C (framework- or SDK-bound, re-expressed as contract tests).
6. Seed the ledger at `docs/migration/parity/<slice>.json`, one row per inventory item.
   Default disposition `port`; `pending-decision` where a seam or open decision touches the
   row; `informative` only for non-normative doc clauses, and a verifier must confirm each.
7. Characterize uncovered behavior: Grifando's 11 pages, its Server Component reads
   (`src/app/page.tsx`, mistakes, vocabulary, today, write), the HTTP status and body shapes
   of every endpoint in both apps, and every fix commit with no test. Write these tests in the
   baseline clone, in the old idiom with the AI boundary faked, and run them green there. UI
   journeys assert roles, labels and contractual copy, not layout. Store tests and run
   reports in `migration/characterization/{pe,grifando}/`.
   - Grifando has no runtime fake provider: `src/server/ai/credentials.ts:32` picks Anthropic
     or Gemini, and the key comes from the visitor's headers. Its journeys therefore fake the
     AI at the network boundary, with a fetch interceptor preloaded through
     `NODE_OPTIONS=--import` (for example MSW) and a dummy BYOK key.
   - Baseline code is never edited.
8. Phase 1 can start once step 4 is done, in parallel with steps 5–7.

Exit:

- `baselines.json` pins both commits and matches the remote tags; BASELINES.md records both
  toolchains; both baseline runs are green, or each red test has an owner decision.
- Re-running the inventory script on the pinned commits and the stored reports reproduces the
  inventory files byte for byte.
- Every inventory row exists in the ledger; every normative row with no source test has a
  characterization test that passed on its baseline.

### Phase 1 — Seam decisions (spec-first, only at the seams)

Goal: decide every intentional difference between the merged product and its sources
before the code that depends on it exists, and redesign nothing else.

1. Draft the merged `CONTEXT.md`. The Evaluation axis keeps PE's vocabulary (Learner,
   Writing Sample, English Passage, Evaluation, Finding, Suggestion, Rubric Version…). The
   Academy uses Grifando's (Mistake Pattern, Occurrence, Mastery Level, Exercise, Attempt,
   Category Ability, Streak). Resolve collisions explicitly — PE forbids "user" and "mistake
   record" as synonyms.
2. Write one ADR per seam rule in PRE_MIGRATION § Product direction, plus one per seam found
   in the code:
   - a. Grifando's model-supplied grammar, vocabulary, clarity and naturalness scores
     (SPEC.md:93) against RUBRIC.md:119, which requires a locally derived score.
   - b. Tenancy and deploy profile: PE FR-02/FR-03 against Grifando's signed anonymous
     session with `userId` on every table. Recommendation: scope every table by Learner from
     day one. A `local` profile has one implicit Learner, a loopback-only bind and the
     Host/Origin guard; a `hosted` profile adds the session cookie, CSP, rate limits and idle
     cleanup.
   - c. Where Grifando's pedagogical fields come from (natural version, `patternKey`, fine
     category, `l1Transfer`, example): a Judge contract change (new Rubric Version) or a
     separate Trainer enrichment of Findings.
   - d. The mapping from Grifando's 13 categories to PE's 9.
   - e. Input caps: PE allows 32 KiB of UTF-8 per sample and a 256 KiB body; Grifando allows
     5,000 characters of text and 2,000 of code.
   - f. Effect Schema in `apps/web` through `packages/contract`, superseding the web clause
     of PE ADR 0002.
   - g. Moving the Progress drill-down selection out of the URL.
   - h. Design language — PE's Evidence Lens (ADR 0003) or Grifando's Warm cream editorial
     (DESIGN.md) — plus font licensing under QR-08.
   - i. The fifth interview score.
   - j. Cleanup scheduling without Vercel cron.
   - k. The items still open in PRE_MIGRATION § Product direction.
3. Each ADR lists the ledger rows it changes and their new dispositions (`port-changed`,
   `superseded` or `drop`). Each ADR also has a decision issue (label `decision`). Owners
   accept by commenting on that issue from their own accounts. The ADR's status line then
   records both names, the date and links to both comments. Until then the rows stay
   `pending-decision`.
4. Draft the merged `docs/product/REQUIREMENTS.md`. Keep PE's FR/QR IDs unchanged — the
   calibration fixtures reference them and REQUIREMENTS.md:4 forbids renumbering. Add new ID
   ranges for Academy and hosted behavior, mapped to Grifando's SPEC sections. Rubric
   Version 1 stays the baseline; any change to the Judge model or contract creates a new
   Rubric Version unless an accepted ADR declares compatibility (RUBRIC.md:9-12).
5. Draft DATA-POLICY.md for each deploy profile, and the new `AGENTS.md` (with `CLAUDE.md`
   as a symlink, as in PE) containing PRE_MIGRATION's agent rules plus this protocol's.

Exit:

- Every decision Phases 2–4 depend on has an accepted ADR: tenancy and deploy profile, the
  contract package in the web app, the Evaluation schema fields (learner, origin), URL
  privacy, and the Judge provider and model for the provisional Rubric Version.
- No `pending-decision` row belongs to a slice scheduled for the next phase; every remaining
  open decision lists the rows it blocks.

### Phase 2 — Skeleton and gates

Goal: an empty product that passes every gate, with proof that each gate fails when it
should.

1. Scaffold the new repo's `main` from PE's tooling template, pinned exactly to PRE_MIGRATION
   § Approved stack (Node 26.13.0; pnpm 12.18.0 with catalog, `allowBuilds` and a pinned
   `packageManager`; Turborepo 2.11.x; TS 7.0.2 with `@effect/tsgo` 0.67.5 at error severity;
   oxlint 1.92.0 type-aware with the Effect preset, oxlint-tsgolint, oxfmt; Vitest with
   `@effect/vitest`; Playwright; husky).
2. Create the workspaces:
   - `apps/server`: Hono with `@hono/node-server` and Effect services;
   - `apps/web`: Vite, React, TanStack Router, with the `hc` client in one API module;
   - `packages/contract`: Effect Schema shared by both sides;
   - `packages/core`: the isomorphic pure domain;
   - `packages/db`: Drizzle with node-postgres inside an Effect Database service; PGlite for
     tests and local mode;
   - `packages/env`: Effect Config;
   - `packages/ui`.
3. Build the cross-cutting seams without features:
   - the typed Effect-to-Hono edge helper requiring a status for every tagged error
     (`satisfies Record<ErrorTag, Status>`), one test per error (pattern: PE `app.ts:67-78`);
   - the deploy-profile Config;
   - the Learner identity service (local implementation only);
   - the loopback and Host/Origin guard (port of PE's `app.ts` onRequest);
   - one process serving the API and the static SPA;
   - a `node:26-slim`, non-root Dockerfile.
4. Write the CI pipeline for gates G1–G12. Run the integration suite against a real Postgres
   service on main. Port docker-smoke from PE `scripts/docker-smoke.ts` for the local profile.
   CI gets the baselines through `scripts/migration/baselines.ts`. Once CI runs, an owner
   extends the `main` ruleset:
   - pull requests only, with required status checks;
   - a required merge queue, with build concurrency 1, that merges only when checks pass.

   Every required check also runs on the `merge_group` event, or the queue waits forever.
   Checks that only make sense on a pull request (G8, G12) report success on `merge_group`,
   because they already gated the PR.
5. Write the migration tooling:
   - `scripts/migration/parity-check.ts` validates the ledger and derives each row's status
     from the Vitest and Playwright JSON reports and the ADR index. The ledger stores no
     status;
   - `scripts/migration/verdict-check.ts` implements G12 (format in Work unit cycle step 10);
   - `scripts/migration/parity-audit.ts` diffs assertions between source and target tests;
   - `scripts/migration/red-green.ts` proves each unit's tests failed first, then passed;
   - `scripts/check-gates.ts` compares config and severities with `gates/baseline.json` and
     counts suppressions;
   - a doc-command check confirms every command named in README or docs exists in
     `package.json`.
6. Self-test the gates with one deliberately broken "canary" PR per gate — e.g. an unmapped
   tagged error, a `.skip` test, a lowered oxlint severity, user text in a query string, a
   Node built-in in `packages/core`, a ledger row pointing at a missing test, a weakened
   matcher, a G12 verdict for an older head SHA, a verdict from the implementing vendor.
   Confirm each is rejected by the intended gate, then close it.
7. Steps 1, 2, 4, 5 and 6 can start during Phase 1. Step 3 waits for the tenancy and
   deploy-profile ADR.

Exit: CI green on main with zero features; every canary PR rejected by its intended gate;
docker smoke passes for the skeleton; parity-check runs in CI and reports 0% verified.

### Phase 3 — Pure domain cores

Goal: port both domain cores into `packages/core`, assertions preserved, before any I/O
exists.

1. PE units: utf8 helpers and byte offsets (TextEncoder and Uint8Array instead of Buffer);
   `protected-content.ts` and its tests; rubric-v1 (word count, score, band,
   applyCorrections); assessment-localization (offset spans re-anchored only when unique —
   fixes Grifando #78 by design); ModelAssessmentSchema (`Schema.Int` and `Schema.Finite`,
   excess properties rejected); the pure part of progress insights; the content hash through
   Web Crypto.
2. Grifando units: recall, mastery, difficulty (Elo), selection, streak, patternKey,
   answerChecking, answerDiff, exerciseType, publicView, analytics, progress averages, and
   the daily and technical prompt banks. Prisma enums become literals from
   `packages/contract`.
3. Run up to four units in parallel, each following the work unit cycle.

Exit: all class-A rows in these slices `verified`; `packages/core` imports no Node built-ins
(lint-enforced); every ported test keeps its source title.

### Phase 4 — Evaluation axis end to end

Goal: PE parity on the approved stack. Live calibration of the new Judge is deferred (see
Calibration deferred).

1. **4a (coordinator):** the Evaluation contract in `packages/contract`, derived from the
   types in PE `evaluation-client.ts`; the Drizzle schema and first migration, scoped by
   Learner and recording the Writing Sample origin.
2. **4b:** persistence and history. Port the learning-history, progress-insights and
   writing-evaluation tests from SQLite to PGlite with their assertions unchanged.
3. **4c:** the Judge service on the AI SDK — one pinned model, no retry, a 90 s deadline and
   a 6,000 output-token cap; no tools and no conversation state, with an injection-resistant
   prompt; records the model that answered; maps failures to the 8 EvaluationModelError
   kinds. Re-express the 12 cases of `openai-evaluation-model.test.ts` as contract tests over
   an AI SDK mock model, checked against the Phase 0 characterization of PE's request.
4. **4d:** Hono routes. Port the 12 cases of `app.test.ts` and the journey in
   `app.integration.test.ts` to `app.request()`. Keep the body limit, `cache-control:
   no-store`, the correlation-ID log event without sample text, and the static SPA fallback.
   Move the Progress evidence selection out of the query string (`port-changed` under its
   ADR).
5. **4e:** web. Port PE's routes and features (Writing Desk, Evaluation Detail, History,
   Progress, Setup & privacy, SpellChecker) and their 56 web cases. Build first against the
   in-memory client, then against the `hc` client. Per ADR 0001 the real backend replaces
   the fake; they never coexist.
6. **4f (serial):** port `e2e/mvp.spec.ts`, then run docker smoke for the local profile.
   Live calibration is deferred (see Calibration deferred).

Exit: all PE-sourced rows `verified`; E2E green; local docker smoke green.

### Phase 5 — Academy on top of Findings

Goal: rebuild Grifando's mistake loop as a consumer that only reads Findings.

1. **5a (coordinator, owner of migrations):** the Academy tables (Mistake Pattern,
   Occurrence linked to its Finding, Exercise, Attempt, Category Ability), cascading when an
   Evaluation is deleted.
2. **5b:** fold Findings into patterns (normalized patternKey, fine category, l1Transfer)
   from the source decided in Phase 1. Demotion when a mistake reappears follows the
   accepted decision; today's behavior is `writingCoachService.ts:99`.
3. **5c:** the Trainer service on the AI SDK — any provider, fallback only on overload,
   60 s timeout; records the model that answered (#77); exercise generation keeps the checks
   in `validateExerciseGenerationResult`; answer explanation never affects grading; provider
   quirks such as removing the array bounds Gemini rejects (commit 0083c7f) are pinned by
   contract tests.
4. **5d:** exercise generation and deterministic grading, plus mastery, recall and Elo
   updates. Port `exerciseService.test.ts` and `interviewService.test.ts` onto PGlite.
5. **5e:** Mistake Notebook, analytics, dashboard and daily session. Hono read endpoints
   replace the Server Component reads; SPA routes are verified against the Phase 0
   characterization journeys.
6. **5f:** seam invariant tests — lint forbids Academy imports of Evaluation write services
   and the Academy's database capability has no writes to Evaluation tables; deleting an
   Evaluation removes the Academy state derived from it; practice-origin samples stay out of
   Finding Rate by default.

Exit: all Grifando core-loop rows `verified`; seam invariant tests green; #77 has a
regression test.

### Phase 6 — Remaining modes, BYOK and hosted profile

Goal: port the remaining Grifando features and the hosted-deployment behavior.

1. Writing modes: Technical English prompts; Explain Code (the snippet is never persisted
   and is treated as Protected Technical Content); Interview (the fifth score follows its
   ADR); Vocabulary; Focus Music links, allowed through CSP `frame-src`.
2. BYOK: the key stays in browser storage and travels only in the `x-ai-provider` and
   `x-ai-key` headers; it is never logged, persisted or put in a URL. Port the key-test
   endpoint and `noKeyInLogs.test.ts`.
3. Hosted profile, as one serial unit for the request pipeline: signed anonymous session;
   rate limits in Postgres fixed windows per Learner and per hashed IP; `DELETE /api/me`;
   90-day idle cleanup run by the scheduler chosen in its ADR; CSP for a static SPA; privacy
   page in EN and PT; landing page and OG image generated at build time; robots and sitemap.
4. Automate the `docs/deploy.md` §5 checklist as the hosted-profile docker smoke.

Exit: every remaining row `verified`, `superseded` or `drop` under an accepted ADR; hosted
docker smoke green, if the owners kept that profile.

### Phase 7 — Parity sign-off and cutover

Goal: prove completeness, get owner acceptance, then retire the old apps.

1. Run parity-check: 100% of rows terminal, zero `pending-decision` rows unless an accepted
   ADR defers them past parity.
2. On a fresh clone of the release commit, run all gates and docker smoke for every kept
   profile. Live calibration is not part of sign-off; it runs when the owners schedule it.
3. Final audit: an agent from the vendor that did not implement the final slice regenerates
   the inventory from the baseline tags and diffs it against the ledger.
4. Owners give product acceptance by using the journeys. This is not code review.
5. Optionally, outside the parity definition: carry data over if the owners decide to — an
   importer for PE's local Evaluations (kept at Rubric Version 1) and, for the hosted
   profile, a plan for Grifando's production data or a fresh start.
6. Cutover, only now:
   - Move production to the product, then archive `<org>/grifando`, and `<org>/prompt-evolution`
     if it is not archived yet. Each archived README gets a line pointing to the product.
   - If the product takes a source repo's name, first rename the source repo (for example
     `grifando-v1`), then rename the product repo. Taking an old name deletes GitHub's
     redirect for it, so do it only after the deploy and links no longer depend on the old
     repo.
   - Remove `docs/migration/` and `migration/` in one commit; git history keeps them (PE's
     rule for shipped `.scratch` work).

Exit: every item in the definition of done holds.

## Work unit cycle

Work units and decision requests are GitHub Issues in the new repo. State lives in labels,
never in files:

- status: `needs-triage`, `ready-for-agent`, `in-progress`, `in-review`, `needs-info`,
  `ready-for-human`, `wontfix` (PE's statuses plus two); a closed issue is done;
- lane: `lane:evaluation`, `lane:academy`, `lane:platform`;
- implementer: `implementer:claude`, `implementer:codex`, on the unit issue and its PR;
- `decision`: an owner decision request, including ADR acceptance.

`docs/migration/README.md` keeps this list.

From Phase 0 on, every agent change reaches `main` through a PR with a G12 verdict. Until
Phase 2 builds CI, the coordinator checks the verdicts by hand.

1. Take one assigned unit: an issue labeled `ready-for-agent` whose body lists its ledger row
   IDs, the source files at the pinned commits and the target paths. The coordinator creates
   and assigns units; agents never pick their own. Swap the label to `in-progress`, add
   `implementer:<vendor>`, then create a fresh worktree and a `wu/<issue>-<slug>` branch from
   main.
2. Read the unit's ledger rows, then the source tests (before the source code) at the pinned
   commit, then the referenced ADRs, CONTEXT.md and AGENTS.md. If anything is ambiguous,
   comment the question on the issue, label it `needs-info`, and stop.
3. **Commit 1, tests only.** Port each source test case. For a `port` row, keep the title
   verbatim and change only mechanics, using the mapping table in `docs/migration/README.md`
   (bun:test → vitest and `spyOn` → `vi.spyOn`; `import.meta.dir` → `import.meta.dirname`
   and `Bun.env` → Effect Config; SQLite temp files → PGlite; Elysia `app.handle` and Next
   handlers → Hono `app.request`; Prisma enums → contract literals; SDK fakes → AI SDK mock
   models). Add typed stubs so the tests compile.
4. **Prove red:** the unit's tests fail on assertions, not on import or compile errors. CI's
   red-green job re-checks this on commit 1.
5. **Commits 2…n** port the code into the target idioms: Effect services and tagged errors,
   Schema, Drizzle repositories inside the Database service, Hono routes through the edge
   helper. Keep algorithms, constants, orderings, limits and messages identical; add no
   behavior.
6. **Prove green:** the unit's tests pass and the full `pnpm verify` passes locally.
7. For class A and B, run a mutation spot-check: break one condition or constant per ported
   module, confirm a ported test fails, revert. List the mutations in the PR body.
8. Write the unit's ledger targets as `file::full title`. Each class-C row also links the
   source or characterization test its contract test re-expresses. The ledger stores no
   status; parity-check derives it.
9. Open one PR for the unit, with `Closes #<issue>` in its body and the
   `implementer:<vendor>` label, and move the issue to `in-review`. CI must be green on every
   gate, red-green, parity-audit and parity-check.
10. **Cross-vendor verification:** an agent from the other vendor reads the source tests,
    the target tests, the ledger diff and the CI artifacts. It never pushes to the PR branch.
    It posts one PR comment that starts with these three lines:

    ```text
    G12 PASS
    Verifier: codex
    Head: <full head SHA>
    ```

    The first line is `G12 PASS` or `G12 BLOCK`, and `Verifier` names the verifying vendor.
    Reasons follow, and are required for BLOCK. A verdict covers only that head SHA; any new
    commit needs a new verdict. BLOCK sends the unit back to step 3 or step 5.
11. Merge: the coordinator adds the PR to the merge queue once every required check is
    green, G12 included. The merge closes the issue. A row is `verified` once its targets
    pass on main, so no follow-up commit is needed.
12. **Stop rule:** after two failed attempts to fix the same gate failure, or whenever green
    would require changing an expected value, a gate or a disposition, comment the failing
    output on the issue, label it `needs-info`, and stop.

## Gates

| Gate | What it enforces |
| --- | --- |
| G1 Types | tsgo typecheck with Effect diagnostics at error severity, in every workspace. |
| G2 Lint and format | Type-aware oxlint with the Effect preset (PE `oxlint.effect.config.ts` pattern), oxlint-tsgolint, `oxfmt --check`. Bans focused and skipped tests, Node built-ins in `packages/core` and `packages/contract`, `zod` imports, Academy imports of Evaluation write services, and `process.env` outside `packages/env`. |
| G3 Tests | Vitest with `@effect/vitest`, unit and integration, a PGlite database per test file; on main the integration suite also runs against a Postgres service container. |
| G4 Build | Server bundle and SPA build; the single process starts and serves `/api/health` and the SPA. |
| G5 E2E | Playwright journeys against the built process, from `e2e/mvp.spec.ts` and the Phase 0 characterization journeys. |
| G6 Docker smoke | Local: loopback-only publication, refusal of non-loopback connections, hostile Host and Origin headers, migrations, data surviving container replacement, image secret scan (from PE `scripts/docker-smoke.ts`). Hosted: session cookie, CSP header, cleanup endpoint refusing calls without its secret, robots and sitemap (from Grifando `docs/deploy.md` §5). |
| G7 Privacy and supply chain | gitleaks (the GitHub Action needs a free license key in organization repos; the CLI does not); `pnpm audit --prod --audit-level high`; the no-key-in-logs test; a test that no route puts user text in a URL or query string; no remote telemetry unless an accepted ADR enables it. |
| G8 Red-green proof | The PR's first commit fails the unit's target tests with assertion errors; the head passes them. |
| G9 Parity check | Every inventory row present with a valid disposition, its status derived from the reports (the ledger stores none); every `port-changed`, `superseded` or `drop` row cites an accepted ADR; every target exists in the Vitest and Playwright JSON reports and passes; `port` targets keep their source titles; only `pending-decision` rows may have skipped tests. |
| G10 Parity audit | For class-A and class-B `port` rows, the target matches or exceeds the source in assertion count, expected literals and matcher strength (no `toEqual` turned into `toMatchObject`). Report-only for class C; its output feeds G12. |
| G11 Gate integrity | Lint and tsgo severities and the CI, Vitest and tsconfig settings are equal to or stricter than `gates/baseline.json`; suppression comments (`oxlint-disable`, `@ts-expect-error`) do not increase without an ADR; the edge helper maps every tagged error to a status, with one test per error. |
| G12 Cross-vendor verification | A required check computed by `verdict-check.ts` on the PR head. It passes only when the newest verdict for the current head SHA is `G12 PASS`, its `Verifier` differs from the PR's `implementer:` label, and its author is the agent account or an organization member (the repo is public, so anyone can comment). |
| G13 Live calibration | Deferred: not a merge gate until the owners schedule it (see Calibration deferred). When it runs: paid and owner-triggered, with frozen fixtures, one request at a time, no retries, a budget preflight and the spend recorded. Once it has passed, it is required again for any change to the Judge's model, prompt, structured contract or Rubric Version. |
| G14 Owner decisions | Accepting the Phase 1 ADRs, answering every `needs-info` product question, setting the calibration budget, giving final product acceptance and approving cutover. Owners decide product behavior and never review code. A decision counts only when an owner posts it from an owner account; with the agent machine account (`HANDOFF.md` step 6), CI can check the author of each linked comment. |

## Definition of done

1. parity-check is green on main and every inventory row is terminal: `verified` (a `port`
   or `port-changed` row whose targets pass on main), `superseded` or `drop` under an
   accepted ADR, or `informative`, merged through a PR with a G12 PASS. No `pending-decision`
   row remains unless an accepted ADR defers it past parity.
2. G1–G11 pass on a fresh clone of the release commit, and docker smoke passes for every
   deploy profile the owners kept.
3. Live calibration (G13) is deferred: it runs after parity, when the owners schedule it.
   Until it passes, the Judge's Rubric Version stays provisional (see Calibration deferred).
4. Known defects fixed by design, each with a regression test: Grifando #77 (Judge and
   Trainer record the model that answered), Grifando #78 (spans located by validated offsets,
   re-anchored only when unique), and PE's Progress drill-down no longer sending
   `originalText` or `correction` in the query string.
5. Seam invariants tested: the Academy only reads Findings and never writes Evaluation data;
   deleting an Evaluation cascades to its Academy state; practice-origin samples are excluded
   from Finding Rate by default; the Evaluation never says "improved".
6. Merged docs match the code: CONTEXT.md, REQUIREMENTS.md (PE IDs unchanged), RUBRIC.md,
   DATA-POLICY.md per profile, ASSET-LICENSES.md (including bundled fonts), the ADRs,
   AGENTS.md, and a README where every command exists (doc-command check).
7. Both owners have recorded product acceptance; only then are the old apps retired and the
   source repos archived.
8. Per unit: ported tests keep their source titles and assertions, red then green proven,
   mutation spot-check listed, rows `verified`, CI green, cross-vendor PASS recorded.

## Agent rules

These add to PRE_MIGRATION § Rules for the new repo's AGENTS.md / CLAUDE.md.

1. Baselines are read-only. Read and run sources only at the pinned commits, through
   `scripts/migration/baselines.ts`, in disposable worktrees outside the new repo's working
   tree. Never push to, tag, open issues or PRs in, or change settings of
   `<org>/prompt-evolution` or `<org>/grifando`. Never change organization or ruleset
   settings. Use only the token the session started with, and never look for another.
2. Precedence: baseline tests, then baseline code, then docs. An accepted ADR overrides all
   three for its rows. When the sources disagree, file a decision request (`needs-info`)
   rather than choosing.
3. Tests come first. In a `port` row, never change an expected value, delete an assertion,
   weaken a matcher, rename the title, or add `skip`, `only` or `todo`.
4. Port behavior, not architecture. Keep algorithms, constants, orderings, limits and
   user-facing messages unless the row is `port-changed`.
5. Behavior no test covers gets a characterization test against the baseline before it is
   ported.
6. Build nothing outside the ledger. Both systems' out-of-scope lists (PE REQUIREMENTS.md
   "Out of scope"; Grifando SPEC.md §8) stay out of scope unless an ADR adds an item.
7. For an open decision, implement neither side. Leave its rows `pending-decision` and list
   the blocked rows in the decision request.
8. Use the CONTEXT.md vocabulary in code, tests and UI, never the synonyms it forbids.
9. Follow PE `docs/agents/effect.md`: errors are `Schema.TaggedError`; services are
   `Context.Service` classes with `static readonly layer`; functions returning an Effect use
   `Effect.fn` names; configuration comes from Config, never `process.env`; Drizzle is used
   only inside the Database service. Read `node_modules/effect/AGENTS.md` and `ai-docs`
   before anything else; the effect-docs MCP mixes Effect 3 and RC pages.
10. The Judge uses one pinned model per Rubric Version, with no retry and no silent
    fallback. The Trainer may fall back, but only on overload. Both record the model that
    answered.
11. Never call a paid model. Tests never need real keys, and CI has none. Live calibration
    runs only when an owner triggers it, within the recorded budget.
12. Never log or persist credentials, hidden reasoning or raw provider bodies, and never log
    Writing Sample text at info level. BYOK keys travel only in request headers.
13. Shared files belong to the coordinator: `packages/db` migrations (generated with
    drizzle-kit, never hand-written, one in flight at a time), the `packages/contract` index,
    CI workflows, `gates/baseline.json`, `docs/migration/baselines.json` and the ledger
    schema. Implementers only add files for their own slice. Implementer tokens lack the
    Workflows permission, so GitHub rejects their pushes to CI files.
14. One unit per branch and PR: no drive-by refactors, dependency bumps or formatting churn
    outside the unit.
15. Never weaken a gate to get green. If a gate seems wrong, file a decision request; only
    the coordinator changes a gate, and only under an accepted ADR.
16. Stop rule: after two failed attempts to fix the same gate failure, or whenever green
    would require changing an expected value, a gate or a disposition, stop and escalate.
17. A verifier never edits the work it verifies and never belongs to the vendor that
    implemented it. Implementer and verifier are recorded in labels and in the verdict
    comment, not in commit messages.
18. Status lives in issue labels and in the status parity-check derives, never in files.
19. Agents never post owner decisions or acceptance. They ask on the issue and wait for an
    owner to answer from an owner account.

## Artifacts

| Path | Purpose |
| --- | --- |
| `docs/migration/{HANDOFF,PRE_MIGRATION,MIGRATION_PROTOCOL}.md` | The setup handoff, the approved stack and this protocol, copied unchanged from PE `.scratch/merge-grifando/` during setup. |
| `docs/migration/baselines.json` | One pin per source: repository, tag and commit SHA. Changed only by the coordinator, in a baseline bump. Pure data, no prose fields. |
| `docs/migration/BASELINES.md` | Toolchains, and how to run each baseline suite and the characterization tests in a disposable clone. |
| `docs/migration/baseline-runs/` | Machine-readable test reports from both baselines — the green reference. |
| `docs/migration/inventory/{pe,grifando}.json` | Generated inventory of every source test case and normative clause, regenerated only from the pinned commits and stored reports, plus the Grifando issue export. Pure data, no prose fields. |
| `docs/migration/parity/<slice>.json` | Ledger rows (id, source ref, class A/B/C, slice, disposition, decision, targets), validated by an Effect Schema in parity-check. No status field: parity-check derives it. Pure data, no prose fields. |
| `docs/migration/README.md` | Meaning of each ledger field, definitions of dispositions and derived statuses, the issue labels, the G12 verdict format, and the mechanical mapping table. Any prose about the JSON files lives here. |
| `migration/characterization/{pe,grifando}/` | Characterization tests written against the baselines in the old idiom, with their run reports. Excluded from the new repo's build. |
| `docs/adr/NNNN-<slug>.md` | Seam and open decisions, each with the owners' acceptance line; the only source of `port-changed`, `superseded` and `drop`. |
| `CONTEXT.md` | Merged glossary of Evaluation and Academy vocabulary. |
| `docs/product/{REQUIREMENTS,RUBRIC,DATA-POLICY,ASSET-LICENSES}.md` | Merged contract: PE FR/QR IDs unchanged, Rubric Versions, data policy per profile, licenses for bundled assets. |
| `AGENTS.md` (`CLAUDE.md` as symlink) | PRE_MIGRATION's agent rules plus this protocol's. |
| `scripts/migration/baselines.ts` | Clones each source repo at its pin, outside the working tree, and fails if the remote tag no longer resolves to the pin. |
| `scripts/migration/{inventory,parity-check,parity-audit,red-green,verdict-check}.ts` | Inventory generation and gates G8–G10 and G12. |
| `scripts/check-gates.ts`, `gates/baseline.json` | Gate integrity (G11): configuration and severity baseline, suppression counts. |
| `scripts/docker-smoke.ts` | G6 per deploy profile, ported from PE and extended with Grifando's `docs/deploy.md` §5 checks. |
| GitHub Issues in the new repo | Work units and decision requests. State is in labels (Work unit cycle); verdicts are PR comments; a closed issue is done. |
| `docs/migration/SPEND.md` | Paid calibration budget and spend log, carried over from PE `.scratch/testing-spend.md`. |

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Agents weaken tests or gates to get green. | G8, G10, G11 and the Phase 2 canary PRs; `port` rows forbid changing expected values or titles; cross-vendor PASS on every unit (G12); the stop rule halts before a gate is weakened. |
| Untested behavior is silently lost (Grifando UI, Server Component reads, fix-commit-only behavior). | The Phase 0 inventory includes normative doc clauses and fix commits; characterization tests run against the baselines first; UI journeys assert roles, labels and contractual copy. |
| Docs contradict code and agents follow the prose. | Precedence: baseline tests, then code, then docs; any contradiction becomes a decision request; the doc-command check catches commands that no longer exist. |
| Seam or open decisions stall the work, or agents invent behavior. | Phase 1 gate; `pending-decision` rows are blocked and are the only ones allowed skipped tests; agents implement neither side; each decision request lists the rows it blocks. |
| Moving the Judge to the AI SDK changes its output (breaking Rubric Version 1 comparability) or calibration overruns its budget. | A new Judge gets a new Rubric Version unless an accepted ADR declares compatibility; Progress segmentation tests are ported; calibration is owner-triggered, with budget preflight, one request at a time, no retries, generation IDs recorded. |
| API drift Effect 4.0 RC → 4.1.2, unstable Effect modules, AI SDK churn, oxlint–tsgo coupling. | Exact pins; upgrades only as dedicated units; agents read `node_modules/effect/AGENTS.md` first and the type checker surfaces drift; oxlint moves only with `@effect/tsgo`. |
| Parallel agents conflict on migrations, the contract index or the ledger. | Coordinator owns migrations; ledger and contract split per slice; GitHub's merge queue tests each PR on the latest main. |
| Required checks stall the merge queue. | Every required check runs on `merge_group`; PR-only checks (G8, G12) report success there. |
| SQLite → Postgres semantic drift in PE persistence (text timestamps, autoincrement IDs, ordering ties, Buffer byte offsets). | Port class-B tests first with assertions unchanged; order every query explicitly; compute byte offsets with TextEncoder, covered by the ported UTF-8 boundary tests. |
| PGlite differs from production Postgres. | On main the integration suite also runs against a Postgres service container, as Grifando's CI already does. |
| Class-C rewrites (SDK, edge and route tests) drift in meaning. | Characterize request and response shapes at the baseline; name each contract test after its source test; mandatory cross-vendor sign-off; live calibration covers the Judge. |
| The seam leaks (Academy writes Evaluation data, practice text inflates Finding Rate). | Lint import restrictions, a database capability type with no Evaluation writes, and the Phase 5f invariant tests. |
| Privacy regresses (keys in logs, user text in URLs, telemetry). | G7: ported no-key-in-logs test, URL-leak test, no telemetry by default until an ADR decides otherwise. |
| Behavior only Next.js provides is lost in the SPA (CSP nonce, OG image, robots and sitemap, cookie on first render). | Explicit ledger rows from `src/proxy.ts`, `opengraph-image.tsx`, `robots.ts` and `sitemap.ts`, each `port-changed` under an ADR (static-SPA CSP, OG image built at build time). |
| A late design-language decision churns UI tests. | Decide it in Phase 1, before 4e; UI tests assert roles, labels and copy, not layout. |
| Licensing and ownership: Grifando is MIT; PE has no license file; the product name is open. | The product license is chosen at setup, before the new repo exists; PE's author chooses PE's license before it goes public; a Phase 1 ADR settles the product name; ported Grifando code keeps the MIT notice. |
| Moving Grifando into the organization breaks its live deploy or CI. | Deferred by the owners, together with the deploy decision; `HANDOFF.md` § Deferred lists the fixes. The migration depends on neither: the baselines are pinned SHAs, and their suites run outside Grifando's CI. |
| A source repo changes after its baseline. | Change policy decided at setup (`HANDOFF.md` step 3); every change goes through a baseline bump with an inventory diff. |
| A baseline tag is moved or deleted. | The SHA pin is the authority; `baselines.ts` fails on a mismatch; tag rulesets restrict updates and deletions. |
| An agent holding owner credentials changes a source repo, a ruleset or organization settings. | Fine-grained tokens limited to the new repo, preferably on a machine account; no Administration permission, so only owners change rulesets; PE archived; agent rule 1. |
| Agent comments look like owner decisions, or one vendor posts the other's verdict. | Agent machine account, so owner decisions are checkable by author (G14); verdicts bound to the head SHA and checked against the `implementer:` label (G12). Vendor identity itself is not enforced: both vendors share the agent account. |

## Evidence

- PE git: only `apps/server/src/index.ts` is tracked under `apps/server/src` (1 of 31 files,
  re-checked 2026-11-10); the web features, `e2e/` and the migrations are untracked.
- Suite sizes (`wc -l` and static `it`/`test` counts): PE 6,290 lines in 28 files, about 165
  cases (108 server, db and env; 56 web; 1 E2E). Grifando 3,959 lines in 49 files, about 276
  cases.
- Grifando UI: 11 pages, 4,134 lines of TSX in `src/app` and `src/components`, zero
  `.test.tsx` files (re-checked). Five pages read repositories directly in Server Components.
- PE server tests use `bun:test` and Bun-only APIs (`import.meta.dir`, `Bun.spawn`, `Bun.env`)
  — e.g. `app.test.ts:1`, `writing-evaluation.test.ts:41`, `openai-evaluation-model.test.ts:402-405`.
- Pure Grifando modules import Prisma-generated enums (`mastery.ts:1` and 12 others); these
  become contract literals.
- Grifando SPEC drift: SPEC.md:235 and :303 describe a local-only app with hosting out of
  scope, yet it is public on Vercel and Neon; §7 omits `lastActiveAt`, `l1Transfer`,
  `consecutiveCorrectCount` and `RateLimitWindow`; §9 lists only the Anthropic provider.
  SPEC.md:211 says a mastered pattern "drops back", but `mastery.ts:63-70` computes "fading"
  at read time; rest-day limits exist only in `streak.ts:10-11`.
- PE doc drift: README.md:53 documents `bun run verify:e2e`, which does not exist (only
  `test:e2e`); `.scratch/testing-spend.md` cites `mise run calibrate:live` after the mise task
  layer was removed (commit 166c977). Both re-checked.
- `protected-content.ts` is 996 lines of heuristics pinned by 236 lines of tests; RUBRIC.md
  covers it in one bullet.
- Seam conflicts: Grifando's model-supplied scores (SPEC.md:93, `schemas/writingAnalysis.ts`)
  vs RUBRIC.md:119; PE loopback-only, no sessions, no learner scope (REQUIREMENTS.md:12-13,
  `packages/db/src/schema/index.ts`) vs Grifando's `ig_session` and `userId` everywhere;
  input caps (PE `writing-evaluation.ts:36`, `app.ts:218` vs Grifando
  `api/writing-sessions/route.ts:16-18`); Vercel Analytics (`layout.tsx:4`) vs PE
  DATA-POLICY.md:37.
- #77 and #78 confirmed in code (`client.ts:28-40`, `resilient.ts`,
  `writingCoachService.ts:83`; `highlightSegments.ts:11`). PE's Progress drill-down sends
  `originalText` and `correction` as query parameters (`http-evaluation-client.ts:66-68`,
  `app.ts:133-139`).
- PE's `EvaluationClient` has an in-memory implementation used by 10 web test files
  (`evaluation-client.ts:156-171`, ADR 0001), so web units can progress against a contract.
- `FAILURE_STATUS` uses `satisfies Record<EvaluationFailureCode, number>` (`app.ts:67-78`) —
  the model for the Hono edge helper.
- Grifando CI runs gitleaks, pnpm audit, typecheck, lint, tests on Postgres 17 and build,
  with no AI keys. PE has no CI, so the new repo's gates must be built, not inherited.
- Behavior recorded mainly in fix commits: 0083c7f (array bounds stripped from the JSON
  schema sent to Gemini) and 8b80767 (lookups scoped to the session user). Both re-checked.
- Paid budget: $3 with about $1.29 spent; a full 30-call calibration no longer fits
  (`.scratch/testing-spend.md`, re-checked). Last live calibration passed 2026-09-16 on the
  current OpenRouter judge.
- Rubric Version rules: changing provider, model, prompt or structured contract defaults to
  a new incompatible version (RUBRIC.md:9-12); calibration fixtures are keyed to FR/QR IDs
  that must not be renumbered (REQUIREMENTS.md:4, `live-calibration-fixtures.ts:7-19`).
- PE forbids Effect in `apps/web` (`docs/agents/effect.md`, ADR 0002), but the approved stack
  shares Effect Schema with the web — a superseding ADR is required.
- Grifando is MIT; PE has no license file. PE's commits use the GitHub noreply address.
- Organization facts, checked 2026-11-10:
  - a transfer keeps issues, PRs, webhooks, secrets and deploy keys, and redirects web and
    git URLs until a repo is created at the old location
    ([GitHub](https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository));
  - merge queues exist for public repos owned by an organization
    ([GitHub](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-a-pull-request-with-a-merge-queue));
  - repository rulesets are free on public repos, while organization-wide rulesets need Team
    ([GitHub](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository));
  - `gitleaks-action` requires `GITLEAKS_LICENSE` for organization repos; the key is free
    ([README](https://github.com/gitleaks/gitleaks-action));
  - Vercel Hobby deploys public organization repos since 2025-07-16, but not private ones
    (Vercel staff in the [community forum](https://community.vercel.com/t/why-cant-hobby-accounts-deploy-from-organizations/10015));
  - an organization repo needs the Vercel GitHub App installed on the organization
    ([Vercel](https://vercel.com/docs/git/vercel-for-github)).
- Grifando on 2026-11-10:
  - `main` (`74dbb9f`) has the same tree as `develop` (`44317f0`);
  - 33 issues, 9 of them open;
  - CI uses `gitleaks/gitleaks-action` v3.0.0 and `postgres:17-alpine`, and PR-Agent reads
    the `GEMINI_API_KEY` secret;
  - `docs/deploy.md` targets the Vercel free plan, and `vercel.json` schedules
    `/api/cron/cleanup`;
  - the README, `package.json`, `SiteFooter.tsx`, `.github/ISSUE_TEMPLATE/config.yml`,
    `CLAUDE.md` and `docs/deploy.md` link to `levyrodrigues23/grifando`;
  - `src/server/ai/client.ts:32,37` builds the Gemini and Anthropic clients directly, with no
    fake for running the app.

## Uncertainties

- Test-case and line counts are static, not runner counts; `.each` tables and skipped tests
  will change the numbers, so Phase 0 takes counts from the reporters.
- The A/B/C classification is a heuristic based on imports and markers; the coordinator
  reclassifies case by case in Phase 0.
- Neither baseline suite was run during the evaluation; whether each is green is unknown.
- Not verified: the exact AI SDK 7 test utilities, and whether
  `@openrouter/ai-sdk-provider` can reproduce PE's request (`store: false`, no tools,
  reasoning config, routed-provider price caps of $2/M input, $12/M output, $0 per request).
  If it cannot, the Judge port is a new Rubric Version, not a compatible port.
- The API drift from Effect 4.0.0-rc.112 to 4.1.2 is unmeasured; PE's Effect code may need
  more than import changes.
- Open decisions that block slices: those in PRE_MIGRATION § Product direction, plus the
  seams found here (model-supplied scores, source of pedagogical fields, tenancy and deploy
  profiles, input caps, Effect Schema in web, design language and fonts, fifth interview
  score, cleanup scheduling).
- Whether parity needs both deploy profiles depends on the deploy decision; if only one is
  kept, the other profile's rows become `drop` under an ADR.
- Grifando's 33 GitHub issues (in Portuguese) have not been read; they may hold accepted
  behavior that is in neither SPEC.md nor the tests. Phase 0 step 4 brings them into the
  inventory.
- Vercel's behavior during a repo transfer comes from community reports, not official docs.
  It matters only if Grifando keeps deploying from Vercel (`HANDOFF.md` § Deferred).
- Untested: whether cloud agent sandboxes (Codex cloud, Claude Code on the web) can reach the
  source repos and GitHub Issues with a scoped token. Local CLIs can.
- Untested: whether the fetch interceptor reaches every AI call in Grifando's Next.js server.
  If it does not, those journeys become `needs-info` and nobody edits the baseline.
- Mutation testing (e.g. Stryker with Vitest) would strengthen G10 but is not in the approved
  stack; manual spot-checks are used unless the owners approve it.
- That cross-vendor verification reduces correlated errors is a judgment about model
  diversity, not a measured property.
- Carrying data over (PE's local history at Rubric Version 1, Grifando's production data) is
  outside the parity definition; the owners decide whether and when.
