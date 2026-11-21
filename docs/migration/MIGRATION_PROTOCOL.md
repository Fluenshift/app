# Migration protocol

How the merge of Prompt Evolution (PE) and Grifando runs from here on: the technique, the
baselines, the open phases, the gates and the definition of done. `AGENTS.md` holds the agent
rules and the work unit cycle. ADR 0019 cut this file to the work ahead; the planning history
(the comparison of techniques, the finished phases, the evidence and the risks) is in commit
`39fbb46`.

## Technique

**Ledger-driven, test-first port into a new neutral repository.** No human reviews code, so the
only reviewer is executable evidence:

- frozen, tagged baselines of both systems;
- a machine-generated inventory of every source test case and every normative doc clause;
- a parity ledger, checked in CI, that gives each inventory row a disposition and target tests;
- characterization tests, run against the baselines, for behavior no test covers;
- ADRs written spec-first, only at the seams, by the session that decides (ADR 0020);
- red-green, assertion-preservation and gate-integrity checks.

PE is the tooling template, not the base. Neither old repository is converted in place.

Source tests port in three classes: A, pure code, nearly verbatim; B, the same assertions on new
persistence fixtures; C, bound to an SDK or a framework, re-expressed as contract tests.

## Repositories and baselines

The organization `Fluenshift` holds three public repositories: `prompt-evolution` and
`grifando`, the frozen sources, and `app`, the product under a working name.

- Each source repository carries a `parity-baseline` tag under a tag ruleset that restricts
  updates and deletions, with an empty bypass list. The product imports no source history.
- `docs/migration/baselines.json` pins each baseline: repository, tag and commit SHA. The pin
  is the authority. The tag only keeps the commit reachable on GitHub.
- `scripts/migration/baselines.ts` clones each source repository outside the working tree
  (default `../<product>-baselines/<system>`) and checks out the pinned commit. It fails if the
  remote tag no longer resolves to the pin. Agents and CI read and run sources only through it,
  in disposable worktrees of those clones. The sources are public, so CI needs no token.
- Grifando stays the live product until cutover, and takes production and security fixes only
  (ADR 0020).

### Baseline bumps

A source repository may change after its baseline, within that policy (ADR 0020),
for example through a production fix in Grifando. Such a change is ported like any other
behavior:

1. The source owner tags the new commit `parity-baseline-N` (N = 2, 3, …). The
   `parity-baseline*` ruleset covers it, and older tags stay.
2. The coordinator runs one unit that updates the pin, runs that baseline suite again and
   regenerates its inventory.
3. The inventory diff drives the ledger:
   - new rows default to `port`;
   - rows whose source is gone become `pending-decision`;
   - rows whose source test changed are audited again.
4. The unit merges only with the parity check green. Rows whose source test did not change keep
   their targets.

## Roles

- **Owners** (Jhefferson and Levy) review nothing and answer nothing (ADR 0020). They keep only
  the owner actions of G14.
- **Sessions** implement units, one unit per branch. One session is the **coordinator**: it
  alone changes the shared files (`AGENTS.md`, Rules).

## Calibration deferred

The owners decided on 2026-11-10 that the priority is getting the merged repository working.
Live calibration (G13) runs after parity, when the owners schedule it. Until it passes:

- G13 is not a merge gate, and Phase 4 exits without it.
- The new Judge runs under a provisional Rubric Version, recorded as uncalibrated, and Progress
  never merges it with Rubric Version 1 (#87 asks how to record it).
- Before the first run, the owners set a new budget. The remaining $3 no longer fits a full
  30-call run.

## Phases

Phases 0 to 3, 4a to 4e and 5a to 5c are merged. The rows still open in each slice are the last
lines of the parity step in CI's test job, or of `pnpm parity` locally (it needs Docker); without
reports, `parity-check.ts` counts every row that has targets as open. `docs/migration/README.md`
maps slices to phases.

### Phase 4: the Evaluation axis, what is left

- **4f:** port the remaining Docker smoke rows of the local profile; `e2e/mvp.spec.ts` drops
  with the other rows that check the interface (ADR 0043).

Exit: all PE-sourced rows `verified`; E2E green; local Docker smoke green.

### Phase 5: the Academy on top of Findings

Goal: rebuild Grifando's mistake loop as a consumer that only reads Findings.

- **5d:** exercise generation and deterministic grading, plus mastery, recall and Elo updates.
  Port `exerciseService.test.ts` and `interviewService.test.ts` onto PGlite.
- **5e:** Mistake Notebook, analytics, dashboard and daily session. Hono read endpoints replace
  the Server Component reads; SPA routes are verified against the Phase 0 characterizations.
- **5f:** seam invariant tests. Lint forbids Academy imports of Evaluation write services, and
  the Academy's database capability has no writes to Evaluation tables; deleting an Evaluation
  removes the Academy state derived from it; practice-origin samples stay out of Finding Rate
  by default.

Exit: all Grifando core-loop rows `verified`; seam invariant tests green; Grifando #77 has a
regression test.

### Phase 6: remaining modes, BYOK and the hosted profile

Goal: port the remaining Grifando features and the hosted-deployment behavior.

1. Writing modes: Technical English prompts; Explain Code (the snippet is never persisted and
   is treated as Protected Technical Content); Interview (scored as ADR 0010 decides);
   Vocabulary; Focus Music links, allowed through CSP `frame-src`.
2. BYOK: the key stays in browser storage and travels only in the `x-ai-provider` and
   `x-ai-key` headers; it is never logged, persisted or put in a URL. Port the key-test
   endpoint and `noKeyInLogs.test.ts`.
3. Hosted profile, as one serial unit for the request pipeline: signed anonymous session, its
   cookie `HttpOnly`, `Secure` and `SameSite=Lax`, with the attributes characterized at the
   Grifando baseline, and no Origin check (ADR 0032); the trusted-proxy setting that decides
   which header carries the client IP (ADR 0033); a documented rotation of the session secret (ADR 0032);
   rate limits in Postgres fixed windows per Learner and per hashed IP;
   `DELETE /api/me`; 90-day idle cleanup run by the scheduler of ADR 0011; CSP for a static
   SPA; privacy page in EN and PT; Grifando's link preview, its metadata static in the shell
   and its OG image a static file (ADR 0040); robots and sitemap.
4. Automate the checks of Grifando's `docs/deploy.md` §5 that ADR 0011 keeps (cleanup has no
   public endpoint) as the hosted-profile Docker smoke: the session cookie, the CSP header,
   robots and sitemap. The checks made in a browser drop (ADR 0043).

Exit: every remaining row `verified`, `superseded` or `drop` under an accepted ADR; hosted
Docker smoke green.

### Phase 7: parity sign-off and cutover

Goal: prove completeness, then retire the old apps.

1. Run the parity check: 100% of rows terminal, zero `pending-decision` rows unless an accepted
   ADR defers them past parity.
2. On a fresh clone of the release commit, run all gates and the Docker smoke for every kept
   profile. Live calibration is not part of sign-off; it runs when the owners schedule it.
3. Final audit: a fresh session regenerates the inventory from the baseline tags and diffs it
   against the ledger.
4. Cutover waits for an owner's go-ahead, because moving production and archiving the source
   repositories cannot be undone.
5. Carry data over as ADR 0018 decides. Grifando's hosted data starts fresh: the old site shows
   a notice for at least 30 days before cutover, and its database stays read-only for 30 days
   after. A one-time importer copies PE's local Evaluations as Rubric Version 1, and the import
   is accepted only when its dry-run counts match (`apps/server/src/import-pe.ts`; `README.md`,
   Importing PE's local history).
6. Cutover, only now:
   - Move production to the product, then archive `Fluenshift/grifando`, and
     `Fluenshift/prompt-evolution` if it is not archived yet. Each archived README gets a line
     pointing to the product.
   - If the product takes a source repository's name, first rename the source repository (for
     example `grifando-v1`), then rename the product. Taking an old name deletes GitHub's
     redirect for it, so do it only after the deploy and the links no longer depend on the old
     repository.
   - Remove `docs/migration/` and `migration/` in one commit; git history keeps them.

Exit: every item in the definition of done holds.

## Gates

| Gate | What it enforces |
| --- | --- |
| G1 Types | tsgo typecheck with Effect diagnostics at error severity, in every workspace. |
| G2 Lint and format | Type-aware oxlint with the Effect preset, oxlint-tsgolint, `oxfmt --check`. Bans focused and skipped tests, Node built-ins in `packages/core` and `packages/contract`, `zod` imports, and `process.env` outside `packages/env`; from 5f, Academy imports of Evaluation write services and of the writable Evaluation tables, which the Academy reads through read-only views. |
| G3 Tests | Vitest with `@effect/vitest`, unit and integration, on PGlite databases; CI also runs the `Database` service against a Postgres 17 service container. |
| G4 Build | Server bundle and SPA build; the single process starts and serves `/api/health` and the SPA. |
| G5 E2E | Playwright journeys against the built process, from `e2e/mvp.spec.ts` and the Phase 0 characterizations. |
| G6 Docker smoke | Local: loopback-only publication, refusal of non-loopback connections, hostile Host and Origin headers, migrations, data surviving container replacement, image secret scan. Hosted (Phase 6): session cookie, CSP header, robots and sitemap. |
| G7 Privacy and supply chain | gitleaks over the whole history; `pnpm audit --prod --audit-level high`; from Phase 6, the no-key-in-logs test; `scripts/check-url-text.ts`, which keeps user text out of URLs (ADR 0008); no remote telemetry (ADR 0013). |
| G8 Red-green proof | The pull request's first commit fails the unit's target tests with assertion errors; the head passes them. |
| G9 Parity check | Every inventory row present with a valid disposition, its status derived from the reports (the ledger stores none); every `port-changed`, `superseded` or `drop` row cites an accepted ADR; every target exists in the test reports and passes; `port` targets keep their source titles; only `pending-decision` rows may have skipped tests. |
| G10 Parity audit | For class A and class B `port` rows, the target matches or exceeds the source in assertion count, expected literals and matcher strength (no `toEqual` turned into `toMatchObject`). Report-only for class C: the unit lists those differences in its pull request. |
| G11 Gate integrity | Lint and tsgo severities and the CI, Vitest and tsconfig settings are equal to or stricter than `gates/baseline.json`; suppression comments (`oxlint-disable`, `@ts-expect-error`) do not increase. Recording a weaker baseline needs an accepted ADR. |
| G13 Live calibration | Deferred: not a merge gate until the owners schedule it (see Calibration deferred). When it runs: paid and owner-triggered, with frozen fixtures, one request at a time, no retries, a budget preflight and the spend recorded. Once it has passed, it is required again for any change to the Judge's model, prompt, structured contract or Rubric Version. |
| G14 Owner actions | Only what cannot be undone outside this repository or costs money: the budget of paid calibration, moving production, and archiving or changing the source repositories. Sessions decide everything else (ADR 0020). |

G12, the cross-vendor verdict, was retired by ADR 0019.

CI (`.github/workflows/ci.yml`) runs each suite once per run. One job holds the static checks:
G1, G2, G4, G11 and the ledger's structure. One job runs every Vitest suite with a report, the
Docker smoke included, then G9 on those reports. The others run Postgres, the end-to-end
journeys, G8, the migration records with G10, and G7. Two rules skip work that cannot fail
(`scripts/ci-changes.ts`): a change that is only Markdown outside the workspaces runs the static
checks and G7 alone, and the gate self-tests (`scripts/gate-selftest.ts`), which prove that each
gate rejects its broken case, run only when a gate changes; they run the suites a second time.

## Definition of done

1. The parity check is green on `main` and every inventory row is terminal: `verified` (a
   `port` or `port-changed` row whose targets pass on `main`), `superseded` or `drop` under an
   accepted ADR, or `informative`. No `pending-decision` row remains unless an accepted ADR
   defers it past parity.
2. G1 to G11 pass on a fresh clone of the release commit, and the Docker smoke passes for
   every deploy profile the owners kept.
3. Live calibration (G13) is deferred: it runs after parity, when the owners schedule it. Until
   it passes, the Judge's Rubric Version stays provisional.
4. Known defects fixed by design, each with a regression test: Grifando #77 (Judge and Trainer
   record the model that answered), Grifando #78 (spans located by validated offsets,
   re-anchored only when unique), and PE's Progress drill-down no longer sending `originalText`
   or `correction` in the query string.
5. Seam invariants tested: the Academy only reads Findings and never writes Evaluation data;
   deleting an Evaluation rebuilds the Academy state it touched (ADR 0031); practice-origin
   samples stay out of every Progress Insight (ADR 0030); the Evaluation never says "improved".
6. Merged docs match the code: `CONTEXT.md`, `REQUIREMENTS.md` (PE IDs unchanged), `RUBRIC.md`,
   `DATA-POLICY.md` per profile, `ASSET-LICENSES.md` (including bundled fonts), the ADRs,
   `AGENTS.md`, and a README where every command exists.
7. An owner has given the go-ahead for cutover; only then are the old apps retired and the
   source repositories archived.
8. Per unit: ported tests keep their source titles and assertions, red then green proven, rows
   `verified`, CI green.
