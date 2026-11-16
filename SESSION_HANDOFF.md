# Session handoff

Where the Fluenshift migration stands and how to resume it. Written on 2026-11-16, at the end of the fifth agent session, for whoever resumes: Jhefferson after a break, or Levy with an agent session of his own.

Live state lives in GitHub (issues, their labels, pull requests) and in the parity ledger. This file records what the repository does not: the owners' standing instructions, the next units with their design notes, and the lessons of past sessions. It replaces the untracked `SESSION_HANDOFF.md` and the `/tmp` handoffs of earlier sessions. Update it at the end of every session, through a pull request like any other change.

## Resume

Open Claude Code or Codex in a checkout of this repository and say:

> Resume the migration from `SESSION_HANDOFF.md`.

The session then reads, in this order:

1. this file;
2. `AGENTS.md` (`CLAUDE.md` links to it), the short form of the rules;
3. `docs/migration/HANDOFF.md`, `PRE_MIGRATION.md`, `MIGRATION_PROTOCOL.md` and `README.md`;
4. `docs/adr/`: 18 ADRs, all accepted by Jhefferson on 2026-11-14 (#5), Levy's acceptance pending;
5. `CONTEXT.md`, the vocabulary of code, tests and UI;
6. after `pnpm install`, Effect's own notes for the installed version: `apps/server/node_modules/effect/AGENTS.md` and its `ai-docs/`.

Then it checks the open issues below for owner answers before planning any work.

## Where things stand on 2026-11-16

- `main` holds Phases 0 to 3, Phase 4 except the E2E journey of 4f (paused, see the owner instructions), Phase 5a (the Academy tables), Phase 5b (#103, closing #102: Findings folded into Mistake Patterns through the Trainer's Enrichment), Phase 5c (the Trainer) and the exercise part of Phase 5d (#105, closing #104: exercise generation, grading, the explanation of an Attempt).
- **In progress, paused at the owner's request: #106, the interview** (the rest of 5d). Its branch `wu/106-interview` is pushed with two commits: the tests first (the 5 `port-changed` rows of `interviewService.test.ts`, a characterization of the follow-up history with its new ledger row, typed stubs and migration `0004` for the interview tables), then `evaluateWriting`'s new origin parameter. What remains is in Next work, item 1. No pull request is open for it yet.
- #107 updates this file. Every other open issue is a decision request waiting on the owners:

| Issue | Asks | Blocks | Recommended answer |
| --- | --- | --- | --- |
| #5 | Levy's acceptance of the 18 ADRs. Jhefferson accepted all of them, and amended ADR 0001 to waive G12. | Nothing: the migration proceeds on Jhefferson's acceptance. An ADR Levy decides otherwise gets its rows reworked. | Levy answers with one comment naming the ADRs he accepts, or "all". |
| #63 | How to treat a ported guard test whose behavior #47 built before the test existed, so that G8 can never see it fail first. | One `evaluation-http` row. | Option 3: `superseded` by the guard tests of #47, under a short ADR. |
| #66 | May two Progress characterization rows that send a Correction in the query string become `port-changed` under ADR 0008? | Two `evaluation-http` rows. | Option 1. Then port both in a small unit, with the Correction in the body of `POST /api/progress/evidence` (`ProgressEvidenceRequest`). |
| #72 | May the PGlite test cases get a 60-second timeout? | Nothing since #82 ordered turbo's tasks; a CI run whose only failures are those timeouts is rerun. | Option 1, under a short ADR (G11 records Vitest settings). |
| #87 | How new Evaluations record the provisional Rubric Version: today `"1"`, which the PE importer of ADR 0018 must not merge with imported Evaluations. | Phase 7. | Option 1: a distinct version such as `"1-provisional"` until live calibration passes. |
| #101 | Does a Naturalness Note cost mastery? Grifando folded its unnatural mistakes like errors; ADR 0014 and `CONTEXT.md` name only Findings. It also lists two readings applied without asking: a note's Mistake Category is always `UNNATURAL_PHRASING`, and Clarity and Other Findings form no Mistake Pattern. | The Naturalness Notes and the natural version (Next work, item 3). | Option 2: a note grows its pattern's occurrence count but is never a failed recall. |

### Ledger snapshot

From `docs/migration/parity/*.json` on `main` after #105: 869 rows, 439 with targets, 67 superseded, 49 informative and 314 open (`port` or `port-changed` rows without targets). No row is `pending-decision`. Six slices are complete: `academy-core`, `evaluation-core`, `evaluation-judge`, `evaluation-persistence`, `evaluation-web` and `platform`. The branch of #106 adds an 870th row, the follow-up history characterization, in `academy-persistence`.

| Slice | Open | Where the open rows come from |
| --- | --- | --- |
| `academy-trainer` | 2 | `noKeyInLogs.test.ts`, which needs a route that calls the Trainer |
| `academy-persistence` | 5 | `interviewService.test.ts` (#106) |
| `academy-http` | 29 | exercises, attempts, interview, pages and vocabulary characterizations; `exercises/route.test.ts` |
| `academy-web` | 42 | `musicLink.test.ts` 25, `specimenData.test.ts` 10, `savedPlaylists.test.ts` 7 |
| `academy-spec` | 42 | Grifando `SPEC.md` 17, `CLAUDE.md` 16, fix commits 7, issues 2 |
| `evaluation-http` | 7 | `dev-proxy.test.ts` 4 (E2E, paused), `app.characterization.test.ts` 3 (#63, #66) |
| `evaluation-e2e` | 6 | `docker-smoke.ts` 5, `e2e/mvp.spec.ts` 1 (paused) |
| `evaluation-policy` | 113 | PE `docs/product/RUBRIC.md` 64, `REQUIREMENTS.md` 40, `DATA-POLICY.md` 9 |
| `hosted` | 68 | key store, credentials, the key test route, proxy, rate limits, client IP, privacy cleanup, `docs/deploy.md` |

`node scripts/migration/parity-check.ts` checks the ledger's structure. `pnpm parity` (it needs Docker) runs every suite and derives each row's status from the reports.

## For Levy

Levy (`levyrodrigues23` on GitHub) wrote Grifando and is the other owner of this repository. Two kinds of work are open to him.

As an owner, which only an owner can do, since agents never post decisions:

- Accept or amend the ADRs on #5, with one comment naming the ADRs accepted, or "all". An ADR he decides otherwise gets its ledger rows reworked in a later unit.
- Answer the decision requests above and any new issue titled "Human feedback needed".
- With Jhefferson, settle step 3 of `docs/migration/HANDOFF.md`: what Grifando may change until the cutover (recommended: production and security fixes only, each ported through a baseline bump). Step 2 there, pointing his local Grifando clones at the organization URL, is his too.

Through an agent session of his own:

- Set up a machine (below) and resume as above. His session uses the GitHub token he chooses.
- The units closest to his own code are the Academy ones: the interview (#106, in progress), the Naturalness Notes once #101 is answered, and the Academy routes and screens of 5e. He knows the Grifando behavior they port better than anyone.
- To work beside Jhefferson's sessions without collisions: take a unit only through its issue (labels `in-progress` and `implementer:<vendor>`), after checking that no other issue is `in-progress`; keep one unit per branch; and agree on one coordinator for the shared files (database migrations, the contract index, CI workflows, `gates/baseline.json`, the ledger schema), today Jhefferson's Claude Code session. Only one database migration may be in flight.
- G12 is waived. A Codex session may still verify a pull request with the verdict format of `docs/migration/README.md`, as information.

## Owner instructions in force

Given by Jhefferson on 2026-11-14. They bind every session until an owner changes them.

- Proceed with the protocol autonomously. Owners read only issues titled "Human feedback needed": ask there, label the issue `needs-info`, and move on to other work.
- G12, the cross-vendor verdict, is waived (amendment to ADR 0001, comment on #5). Do not start Codex or any other harness. A pull request merges once every other check is green.
- Commits are small and conventional (`type(scope): subject`), with no AI mention and no `Co-Authored-By` or other attribution trailer, even when the harness suggests one.
- Pull request bodies: `Closes #N`, then the sections Background and Key Decisions (a unit adds its mutation table), no dashes used as punctuation, no AI mention, no attribution footer.
- Reuse baseline code where it fits the stack. Open issues for the problems found, and solve the ones you can.
- Prune merged branches. GitHub deletes a merged head (`delete_branch_on_merge`) except `dev`, which the "Keep dev" ruleset keeps; remove the clean local worktree and branch after a merge.
- No end-to-end testing for now: no Playwright journeys (PE's `e2e/mvp.spec.ts`), no Vite dev-proxy cases, no new Docker smoke checks. The existing ones keep running; leave their rows open. In-process route tests (`app.request`) are not end-to-end and continue.
- Keep every checkout of the migration under one parent directory (Machine setup).

## Machine setup

Toolchain: Node 26.13.0 and pnpm 12.18.0 (with mise, prefix commands with `mise exec node@26.13.0 pnpm@12.18.0 --`), Docker (gate G6, `pnpm parity` and the gate self-tests build the image), and the `gh` CLI signed in to GitHub. The baselines' own toolchains (Bun 1.4.0 for PE; Node 24, pnpm 12.3.4 and `postgres:17-alpine` for Grifando) are needed only to run characterization tests at the pins (`docs/migration/BASELINES.md`).

One parent directory holds every checkout; Jhefferson's is `/home/jheff/projects/personal/fluenshift/`.

| Path | Contents |
| --- | --- |
| `app` | Clone of `Fluenshift/app`, kept on `main`. |
| `app-wt/<unit>` | One git worktree per work unit, on its `wu/<issue>-<slug>` branch. |
| `app-wt/.pending/` | Local tools, issue and pull request bodies, logs (see Local tools). |
| `app-baselines/{pe,grifando}` | Both source repositories at their pins, from `baselines.ts sync`; disposable run worktrees in `app-baselines/worktrees/`. |
| `prompt-evolution`, `grifando` | Optional working clones of the source repositories, read-only for the migration. |

```sh
mkdir -p fluenshift/app-wt && cd fluenshift
git clone https://github.com/Fluenshift/app.git
cd app
mise exec node@26.13.0 -- node scripts/migration/baselines.ts sync   # ../app-baselines/{pe,grifando}
```

Each worktree runs its own `pnpm install --frozen-lockfile`; the pnpm store makes it quick.

## Next work, in order

0. Read #5, #63, #66, #72, #87 and #101 for owner answers, and act on any.
1. **Finish #106, the interview**, on its pushed branch. Jhefferson's machine still has its worktree, `$F/app-wt/wu106`; elsewhere, `git -C $F/app fetch -q origin && git -C $F/app worktree add $F/app-wt/wu106 wu/106-interview`, then `pnpm install --frozen-lockfile`. The tests (`apps/server/src/academy/interview-service.test.ts`) and the typed stubs (`interview-service.ts`) are in the first commit; port Grifando's `interviewService.ts` and `interview.repository.ts` into them:
   - Tables (migration `0004`, already generated): `interview_sessions` and `interview_turns`. A turn keeps no copy of its answer, because deleting an Evaluation removes its Writing Sample (`DATA-POLICY.md` § Deletion): it holds `evaluation_id` (set null when that Evaluation is deleted), `answered_at`, and the `model` that asked its question (ADR 0012). Read an answer through the turn's Evaluation (`original_text`), scoped to the Learner.
   - `startInterview(trainer)`: a session, then `trainer.continueInterview([])`, then turn 0 with the model that answered.
   - `answerTurn(evaluate, trainer, { sessionId, turnId, answer })`: the session of the Learner, else `NotFoundError({ resource: "Interview session" })`; the turn in it, else `NotFoundError({ resource: "Interview turn" })`; then `evaluate(answer)`, the Judge's Evaluation of a practice Writing Sample that the caller provides (ADR 0010), so the Academy writes no Evaluation data; its failure passes through and records nothing. Record `evaluation_id` and `answered_at`; when `order + 1 >= 6` (Grifando's `MAX_TURNS`) end the session and answer `{ status: "ended", evaluation }`; otherwise ask `continueInterview` with every answered turn so far in order plus this one (the characterized history), create the next turn, and answer `{ status: "answered", evaluation, nextTurn }`. `Effect.fn` keeps the generic parameters of `evaluate`.
   - `getSession(sessionId)` and `endInterview(sessionId)` (true only when the Learner's session changed), as Grifando's repository.
   - Ledger targets in `apps/server/src/academy/interview-service.test.ts`: the three rows whose titles stay, the characterization row (`port`, same title), and two renamed rows: "scores the answer via the Writing Coach pipeline and asks a follow-up" becomes "evaluates the answer as a practice Writing Sample and asks a follow-up", and "returns a failed result and does not create a follow-up question when analysis fails" becomes "fails and does not create a follow-up question when the Evaluation fails".
   - Then the mutation spot-check, G8, G10, `pnpm verify`, and the pull request.
2. **The Trainer's keys** (Phase 6 step 2; needed before any route calls the Trainer). ADR 0012 and ADR 0003: the `local` profile reads the key from server configuration (Grifando's `AI_PROVIDER`, `GEMINI_API_KEY` and `ANTHROPIC_API_KEY`, through Effect `Config` in `packages/env`, beside the model pins of `TrainerConfig`); the `hosted` profile takes it from the `x-ai-provider` and `x-ai-key` request headers only, never stored or logged. Rows in `hosted`: `credentials.test.ts` (`readAICredentials` 3, `resolveAICredentials` 3 `port-changed` under ADR 0012 with production read as the hosted profile, `aiErrorResponse` 2, which become entries of the edge helper with Grifando's codes and statuses: `AI_KEY_REQUIRED` 401, `AI_KEY_REJECTED` 401, `AI_KEY_INVALID` 400, `AI_QUOTA_EXCEEDED` 429, `AI_UNAVAILABLE` 503) and the key test route `ai-key/test/route.test.ts` (8, over `TrainerClient.testKey`; its rate limiter case waits for the hosted request pipeline); then `noKeyInLogs.test.ts` (2, `academy-trainer`) with the first route that calls the Trainer. Trap: `accessErrorForStatus > classifies provider statuses` (`hosted`, class A) pins behavior that #96 already built in `ai-sdk-trainer.ts`, so its ported test passes before any code and cannot be a G8 target. Add it to the question of #63 instead of working around the gate.
3. **The Naturalness Notes and the natural version**, once #101 is answered: the Enrichment also returns the notes (correct but unnatural spans, Mistake Category `UNNATURAL_PHRASING`, stored as `UNNATURAL` Occurrences without a Finding, as the tables of #89 already allow) and the natural version (a new column of `enrichments`). The answer to #101 decides whether a note is a failed recall. Their rows: Grifando `SPEC.md` §5.1 (`academy-spec`, `port-changed` under ADR 0004) and its screens in 5e.
4. **5e**: the Academy routes (`academy-http`, 29) and screens (`academy-web`, 42), without browser journeys. The routes compose the services: `evaluateWriting(..., "practice")` for Academy writing and interview answers, then `foldEvaluation` (5b), whose transaction records nothing on failure and refuses a second fold, so the Enrichment alone can be retried when it fails after the Evaluation was stored; how the screens show that is 5e's choice. Grifando's daily session (`afterSessionId`, which mixes the patterns of the latest Writing Sample into a practice set) has no test at the service or the route, so it gets a characterization test at the baseline before its port.
5. **5f**: the seam invariants and the `academy-spec` rows. The lint rule that forbids Academy imports of Evaluation write services must name the write functions (`persistEvaluation`, `deleteEvaluation`, `evaluateWriting`), because the Academy reads through `getEvaluation` from the same `learning-history.ts`. Progress does not exclude practice-origin Writing Samples from the finding rate yet (ADR 0010); that is a 5f invariant.
6. Phase 6 (`hosted`), the `evaluation-policy` rows, then Phase 7 (the PE importer of ADR 0018). Read the protocol to place each one before planning it.

While the E2E pause holds, skip the `evaluation-e2e` rows and the `dev-proxy.test.ts` rows.

Dependabot reports two open alerts on `main`, both from development tools: esbuild 0.18.20 (medium, alert 2), which drizzle-kit 0.31.11 pulls in through the deprecated `@esbuild-kit/esm-loader` and which matters only to esbuild's development server; and deepmerge 4.3.1 (low, alert 1, no fixed release yet), through ultracite. A fix changes dependencies, so it belongs in a dedicated unit.

## The Academy and the Trainer, as the next units find them

- `TrainerConfig` (`packages/env/src/trainer.ts`) holds the model pins: `claude-sonnet-5` and `gemini-3.5-flash` answer unless `ANTHROPIC_MODEL` or `GEMINI_MODEL` names another model; the fallbacks are `claude-haiku-5-5` and `gemini-3.5-flash-lite`, which the environment never changes.
- `TrainerClient` (`apps/server/src/academy/trainer/trainer-client.ts`): `trainerFor({ provider, apiKey })`, with the key as a `Redacted` value, builds a Trainer for that key. The primary model answers each call within 60 seconds; the fallback answers once when the primary is overloaded or times out. `testKey(credentials)` makes one 1-token call on the light fallback model and answers `works`, `invalid` or `busy` within 15 seconds.
- `TrainerMethods` (`trainer-model.ts`): `enrichFindings`, `generateExercises`, `explainAttempt` and `continueInterview`. Every result names the `model` that answered. Failures are `TrainerKeyRejectedError`, `TrainerQuotaExceededError`, `TrainerUnavailableError`, and `AIResponseValidationError` (from `@fluenshift/contract`) for an answer its schema or rules refuse.
- The Enrichment (`prompts/enrichment.ts`, `ai-sdk-trainer.ts`): one entry per Finding, numbered, with a Mistake Category that rolls up to the Finding's Error Category (`errorCategoryOf` and `mistakeCategoriesOf` in `packages/contract/src/academy.ts`, ADR 0005), a Pattern Key, the L1 Transfer flag and an example.
- The Academy services in `apps/server/src/academy/`, each scoped to the Learner of the request: `pattern-folding.ts` (`foldEvaluation`: Findings of Clarity and Other are left out, the Trainer is not called without another Finding, and one transaction records the `enrichments` row with the answering model, the patterns and the Occurrences), `mistake-pattern-repository.ts` (`upsertPattern`, `upsertPatternRow` for transactions, `listPatterns` with `l1TransferOnly`, `findPattern`, `recordAttempt`), `exercise-service.ts` (`generatePracticeSet`, `submitAttempt`, `explainAttempt`; each Exercise records its model), `exercise-repository.ts`, `category-ability-repository.ts`, and `errors.ts` (`NotFoundError`, which the routes answer with 404).
- Nothing wires the Trainer or the Academy into `apps/server/src/index.ts` yet, and no route uses them.
- Their tests never call a provider: AI SDK mock models (`trainer-test-models.ts`), the real providers over a fake `fetch` (`trainer-client.test.ts`), or fake `TrainerMethods` whose calls answer Effects (the service tests).

## How a unit runs

```sh
F=/home/jheff/projects/personal/fluenshift                                   # the parent directory
export PATH="$(mise exec node@26.13.0 pnpm@12.18.0 -- sh -c 'echo $PATH')"   # husky needs pnpm
gh issue create --repo Fluenshift/app --title "..." --body-file <body.md> \
  --label ready-for-agent --label lane:<lane>
gh issue edit <n> --repo Fluenshift/app --remove-label ready-for-agent \
  --add-label in-progress --add-label implementer:claude
git -C $F/app fetch -q origin && git -C $F/app worktree add $F/app-wt/wu<n> -b wu/<n>-<slug> origin/main
cd $F/app-wt/wu<n> && pnpm install --frozen-lockfile --prefer-offline
# commit 1: the ported tests and typed stubs, every target red on an assertion
git -c commit.gpgsign=false commit -m "test(<scope>): ..."
# commits 2 to n: the port; then the mutation spot-check and the ledger targets
node scripts/migration/red-green.ts --base origin/main --head HEAD    # G8
node scripts/migration/parity-check.ts                                # G9, structure only
node scripts/migration/parity-audit.ts --root $F/app-baselines        # G10
pnpm verify
git push -u origin HEAD
gh pr create --draft --title "..." --body-file <body.md> --label implementer:claude
gh issue edit <n> --repo Fluenshift/app --remove-label in-progress --add-label in-review
bash $F/app-wt/.pending/tools/merge-when-green.sh <pr>   # in the background; CI takes about 15 minutes
gh issue edit <n> --repo Fluenshift/app --remove-label in-review   # once the merge closes the issue
```

Jhefferson's git signs commits with GPG; his agent sessions commit unsigned with `git -c commit.gpgsign=false` per command, never by changing the configuration. Another implementer labels its units with its own `implementer:<vendor>`.

## Local tools

Small helpers kept outside the repository, in `app-wt/.pending/`. Another machine can rebuild them from these descriptions:

- `tools/merge-when-green.sh <pr>` (appendix): waits for a pull request's checks, ignoring `G12`; reruns a run whose only failures are the PGlite timeouts of #72, at most four times; then marks the pull request ready, merges it with a merge commit, and removes the clean local worktree and the local branch. Exits 1 when another check fails, 2 after 40 minutes.
- `mutation-tools/mutate.mjs <workspace> <mutations.json>`: for each `{ file, from, to, tests }`, replaces the one occurrence of `from`, runs `vitest run --reporter=json` on `tests` in the workspace, lists the failing tests, and restores the file.
- `mutation-tools/targets.mjs <repo> <slice> <report.json> <map.json>`: for each row of the slice whose source file is in the map (`{ "<source>": "<target test file>" }`), sets `targets` to `<target>::<row title>` once that test has passed in the Vitest JSON report.
- `tools/ledger-union.ts <repo> <ledger file>...`: during a merge conflict in `docs/migration/parity/`, keeps the union of both sides' rows by id, with the union of their targets, and refuses rows whose disposition or decision differ.

## Lessons that still apply

Process and gates:

- Never delete a base branch while pull requests target it: GitHub closes them. Retarget dependents to `main` (`gh api -X PATCH repos/Fluenshift/app/pulls/N -f base=main`) right after each merge.
- Sibling units conflict in generated files. Ledger files: unite the rows (`ledger-union.ts`). Reports and inventories: take theirs (`git checkout --theirs`), then rerun `characterization-run.ts` and `inventory.ts`. `BASELINES.md` tables: edit by hand.
- `gh pr edit` fails on gh 2.46 (Projects classic); use `gh api -X PATCH repos/Fluenshift/app/pulls/N -F body=@file`.
- G8 reads a target at the first commit of the pull request whose test file contains its title. If a test with that title already exists and passes there, G8 fails: give the new test a new title. A ported test whose behavior an earlier unit built passes before its code and cannot be a G8 target (#63).
- G8 runs whole test files at the first commit. A test that waits for a call the stub never makes hangs until the 60-second timeout of `apps/server`: still red, only slow.
- Never `sed` a title inside `docs/migration/parity/*.json`: the row `id` holds the same text. Edit `targets` with a script that leaves `id` alone.
- A change to `playwright.config.ts`, `.husky/*`, a Vite or oxfmt configuration, a workflow or a gate script makes G11 fail until `node scripts/check-gates.ts --write` records `gates/baseline.json` again. G11 also records Vitest settings, `testTimeout` included; changing one needs an accepted ADR (protocol rule 15), not just a new record. `turbo.json` is not recorded.
- G10 reports class C differences without failing; they go in the pull request body.
- A mutation survivor in a port means untested baseline behavior: characterize it at the pin (`characterization-run.ts <pe|grifando> --root $F/app-baselines`; the default root clones the baselines again), regenerate the inventory, run `ledger-add.ts`, then fold the ported cases into the first commit (`git commit --fixup=<sha>`, then `GIT_SEQUENCE_EDITOR=true git rebase -i --autosquash origin/main`). Class C survivors are reported in the pull request, not characterized.
- CodeQL fails a pull request on `js/biased-cryptographic-random` (`randomBytes` with `%`): use `randomInt`.
- A full CI run with the Docker jobs takes about 15 minutes.
- A unit that needs a module from an unmerged unit can branch from that unit's branch, then `git rebase origin/main` once it merges.
- Only one migration is in flight: a unit that adds one either waits for the previous unit's merge or branches from it and runs `pnpm db:generate` only after that merge (#106 branched from #104 and fast-forwarded onto `main` once #105 merged).
- G8 accepts a target that is red on an error rather than an assertion and notes it. Stubs that return a wrong placeholder value make most targets fail on assertions; a stub that dies makes all of them notes.
- `inventory.ts` looks for the baselines beside the checkout (`<checkout>-baselines`): from a worktree, pass `--root $F/app-baselines`, as for G10. A new characterization case: write it in `migration/characterization/<system>/files/`, run `characterization-run.ts <system> --root $F/app-baselines` (Grifando's run takes a few minutes with Docker), regenerate the inventory, check it with `inventory.ts --check --root ...`, run `ledger-add.ts --slice <slice> --class <A|B|C> <row id>`, and update the table of `docs/migration/BASELINES.md` by hand.
- `merge-when-green.sh` can outlive the tool call that starts it: `setsid nohup bash $F/app-wt/.pending/tools/merge-when-green.sh <pr> > <log> 2>&1 < /dev/null & disown`, then read the log.

Stack:

- `ServerConfig` needs `DATA_DIRECTORY` (local) or `DATABASE_URL` (hosted): anything that starts the built server must set it.
- The server bundle keeps npm packages external, so every npm package that bundled workspace code imports must also be a dependency of `apps/server`.
- PGlite creates its data directory but not the parents; `Database.pglite` creates them. The server's persistence tests open a PGlite database per case; `apps/server/vitest.config.ts` sets a 60-second test timeout.
- A schema change before its first migration merges: delete the generated folder and run `pnpm db:generate` again; after a merge, only new migrations. Tests name the tables they check and count migrations from the files.
- pnpm 12 fails an install on a dependency build script nobody reviewed: list it in `allowBuilds` (`esbuild: false` keeps install scripts off). "Run pnpm approve" after an install is a notice, not a failure.
- `createApp` takes optional boundaries (Effects) and a `runtime` (`EdgeRuntime`); tests pass `ManagedRuntime.make(LearnerIdentity.local)`.
- The Judge's tests drive the real OpenRouter provider through a fake `fetch`. In-body provider errors arrive as `APICallError` with `statusCode` 200 and the error in `data`; unparseable or schema-violating output is `NoObjectGeneratedError`.
- The Trainer's tests drive `@ai-sdk/anthropic` and `@ai-sdk/google` through a fake `fetch` too. Anthropic names the model in the request body and sends the key in `x-api-key`; Google names it in the path (`/models/<id>:generateContent`) and sends `x-goog-api-key`. A fake Google error must carry `error.status` (for example `INVALID_ARGUMENT`): without it the provider loses the error message, and a rejected key reads as an unmapped failure.
- With the AI SDK on Effect's `TestClock`, wait until the fake `fetch` has been called before moving the clock; the request's `AbortSignal` shows whether a timeout interrupted it.
- Web tests use Testing Library's 1-second `findBy*` default; under heavy local load two failed once and passed on rerun. If CI shows it, order `web#test` after `server#test` in `turbo.json`.
- Web ports: no `@/` alias (G11 records `vite.config.ts`), so test imports are relative; `noUncheckedIndexedAccess` and the complexity limit (20) reshape loops and big render functions, never their output.

Effect 4.1.2 and lint:

- `Config.NonEmptyString`, `Config.Port`, `ConfigProvider.fromEnvRecord`. An empty variable reads as missing, so `Config.withDefault` applies to it. A service class is itself an Effect (`yield* ServerConfig`).
- `lint:effect` requires `Schema.TaggedError<X, { readonly brand: unique symbol }>`. `Effect.catch` is the catch-all, `Effect.catchIf` takes a refinement, `Effect.catchDefect` recovers defects and `Effect.match` turns a failure into a value. `Effect.timeout` fails with a `TimeoutError` (`Cause.isTimeoutError`). `TestClock.layer()` and `TestClock.adjust` come from `effect/testing`. The Effect diagnostics flag `unknownInEffectCatch`, `catchConditionalRefailToCatchIf` and `catchAllToMapError`.
- oxlint's `unicorn/no-array-method-this-argument` reads `Effect.forEach(array, f)` as an array method with a `this` argument, and the Effect diagnostics flag `Effect.all(array.map(f))` (`allOfMapToForEach`): use the data-last form, `pipe(array, Effect.forEach(f))`.
- `unicorn/no-array-reduce` bans `reduce`, and lint bans `await` in loops: a sequential chain of queries inside one Drizzle transaction recurses (`foldInOrder` in `pattern-folding.ts`). A Drizzle transaction callback receives a client that `DrizzleClient` accepts, so repository helpers can take either.
- `Effect.fn` keeps a generator's type parameters (`function* <E, R>(evaluate: (answer: string) => Effect.Effect<A, E, R>)`), so a service can take an Effect-returning capability without naming its errors.
- `packages/core` exports by path (`@fluenshift/core/<module>`), with no barrel. `expect` takes one argument; no `await` inside loops; arrow constants (`func-style`); no `expect` inside `it.effect` (`no-standalone-expect`), so use plain `it` with `Effect.runPromise`. No `new Promise` (`promise/avoid-new`): use `Promise.withResolvers`. A helper that captures nothing moves to module scope (`unicorn/consistent-function-scoping`).

Shell:

- `pkill -f <pattern>` inside a tool call kills the call's own shell when the pattern is in its command line: use `pgrep -f 'dist/index.mj[s]' | xargs -r kill`. Never edit a running bash script in place; write a copy and `mv` it over.
- A `\uXXXX` sequence typed in a tool input reaches the file as the real character. Write escapes with a script (Python `"\\" + "uFEFF"`) and check for invisible characters.
- `mise exec` prunes unused tool versions on its own when it starts; nothing in the repository asks for it.
- Turbo shares its cache across worktrees (an untracked `.turbo/` in each checkout).
- `git -C $F/app worktree add <path>` resolves a relative `<path>` against `$F/app`, which puts the worktree inside the main checkout: always give the worktree an absolute path.

## Jhefferson's machine

- Claude Code keeps this project's memory in `~/.claude/projects/-home-jheff-projects-personal-fluenshift-app/memory/`.
- A session hook makes the agent reply in caveman style; everything written to the repository or to GitHub stays plain English.
- The interactive shell aliases `grep` to ugrep; one-liners use `/usr/bin/grep`.
- `app-verify/protocol-review` is an old verification checkout whose commit is not in `main`; keep it.

## Appendix: `merge-when-green.sh`

Set `FLUENSHIFT_APP` to the main checkout of `Fluenshift/app` when it is not Jhefferson's path.

```bash
#!/usr/bin/env bash
# Waits for a PR's CI, then merges it with a merge commit. The G12 status is informational
# (owner's amendment to ADR 0001), so its failure does not block. GitHub deletes the merged head
# branch (delete_branch_on_merge, `dev` excepted by the "Keep dev" ruleset); this script then
# removes the branch's local worktree when it is clean, and the local branch.
# Exits 1 if any other check fails, 2 on timeout.
set -uo pipefail
R=Fluenshift/app; n=$1
REPO=${FLUENSHIFT_APP:-/home/jheff/projects/personal/fluenshift/app}
prune_local() {
  local branch=$1 wt
  git -C "$REPO" fetch -q --prune origin
  wt=$(git -C "$REPO" worktree list --porcelain | awk -v b="refs/heads/$branch" '/^worktree /{w=$2} $0=="branch "b{print w}')
  if [ -n "$wt" ] && [ -z "$(git -C "$wt" status --porcelain)" ]; then
    git -C "$REPO" worktree remove --force "$wt" && echo "removed worktree $wt"
  fi
  git -C "$REPO" branch -q -D "$branch" 2>/dev/null && echo "deleted local branch $branch"
  return 0
}
# A run whose only failure is the PGlite cold-start timeout of packages/db (#72, waiting on the
# owners) is rerun, at most four times; any other failure stops the script.
is_pglite_timeout_only() {
  local failing=$1 link job log
  [ "$(wc -l <<<"$failing")" -eq 1 ] && grep -q '^G1 to G4' <<<"$failing" || return 1
  link=$(cut -f2 <<<"$failing"); job=${link##*/job/}
  log=$(gh api "repos/$R/actions/jobs/$job/logs" 2>/dev/null) || return 1
  # Every failed case is a timed-out case of packages/db's database.test.ts, and nothing else
  # failed: no other test file, type error or lint finding.
  local fails errors
  fails=$(grep -a ' FAIL ' <<<"$log" | sed -E 's/\x1b\[[0-9;]*m//g')
  errors=$(grep -a '^.\{28\}Error: ' <<<"$log" | sed -E 's/\x1b\[[0-9;]*m//g' | grep -v 'Test timed out in 5000ms')
  [ -n "$fails" ] &&
    ! grep -qv 'src/database.test.ts > Database > ' <<<"$fails" &&
    [ -z "$errors" ] &&
    grep -q '@fluenshift/db#test' <<<"$log" &&
    ! grep -qE 'error TS[0-9]+|eslint\(|oxlint' <<<"$(grep -a '##\[error\]' <<<"$log")"
}
reruns=0
for _ in $(seq 1 120); do
  out=$(gh pr checks "$n" --repo $R 2>/dev/null | awk -F'\t' '$1 != "G12" {print $2}')
  if [ -n "$out" ] && ! grep -q pending <<<"$out"; then
    if grep -qE 'fail|cancel' <<<"$out"; then
      failing=$(gh pr checks "$n" --repo $R | awk -F'\t' '$1 != "G12" && $2 ~ /fail|cancel/ {print $1"\t"$4}')
      if [ "$reruns" -lt 4 ] && is_pglite_timeout_only "$failing"; then
        run=$(sed -E 's#.*/runs/([0-9]+)/job/.*#\1#' <<<"$(cut -f2 <<<"$failing")")
        echo "PR #$n: only the PGlite timeout of #72 failed; rerunning run $run"
        gh run rerun "$run" --repo $R --failed && reruns=$((reruns + 1))
        sleep 30
        continue
      fi
      echo "PR #$n: a check failed"; gh pr checks "$n" --repo $R | awk -F'\t' '{print $1"="$2}'; exit 1
    fi
    head=$(gh api "repos/$R/pulls/$n" --jq .head.ref)
    gh pr ready "$n" --repo $R >/dev/null 2>&1 || true
    gh api -X PUT "repos/$R/pulls/$n/merge" -f merge_method=merge --jq '"PR #'"$n"' merged=\(.merged) \(.sha[0:7])"' || exit 1
    [ "$head" = "dev" ] || prune_local "$head"
    exit 0
  fi
  sleep 20
done
echo "PR #$n: timed out waiting for checks"; exit 2
```
