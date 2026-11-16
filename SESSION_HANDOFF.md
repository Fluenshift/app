# Session handoff

Last updated 2026-11-16, at the end of the fifth agent session. This file holds only what the repository and GitHub do not: the work in flight, the owners' standing instructions, and the gotchas earlier sessions paid for. For everything else it points to the artifact that holds it. Rewrite it at the end of every session, through a pull request.

## Resume

Say: "Resume the migration from `SESSION_HANDOFF.md`." Then:

1. Follow `AGENTS.md` (Claude Code loads it as `CLAUDE.md`; Codex reads it directly) and use the vocabulary of `CONTEXT.md`. Some passages of the long migration documents are stale: [Docs and tools that slow down or mislead agents](#docs-and-tools-that-slow-down-or-mislead-agents) lists them. Where they disagree with an accepted ADR or with this file, the ADR and this file are current.
2. Run `gh issue list --repo Fluenshift/app --state open`. On each issue labeled `decision`, look for an owner's answer; act on it before planning other work.
3. Take the first open item of [Next steps](#next-steps).

Done when one issue is labeled `in-progress` for you and you are in its worktree.

## State on 2026-11-16

| Work | State | Details |
| --- | --- | --- |
| 5b: Findings folded into Mistake Patterns through the Trainer's Enrichment | merged | PR #103, closes #102 |
| 5d, first part: exercise generation, grading, explanation of an Attempt | merged | PR #105, closes #104 |
| 5d, second part: the interview | in progress, paused | #106 and its [comment of 2026-11-16](https://github.com/Fluenshift/app/issues/106#issuecomment-6906562621); branch `wu/106-interview` |
| This handoff | in review | #107, PR #108 |
| Owner decisions | waiting | #5, #63, #66, #72, #87, #101; each issue states its options and a recommendation |

Earlier work (Phases 0 to 4, 5a, 5c): `git log --first-parent --oneline main`. Ledger status: `node scripts/migration/parity-check.ts` prints the counts per slice from the ledger's structure; `pnpm parity` (needs Docker) derives each row's status from the test reports.

## Next steps

1. Finish #106, following its comment of 2026-11-16. Jhefferson's machine still has the worktree `$F/app-wt/wu106`; elsewhere, `git -C $F/app worktree add $F/app-wt/wu106 wu/106-interview`.
2. The Trainer's keys (Phase 6 step 2), needed before any route calls the Trainer. Rows: `hosted` (`credentials.test.ts`, `ai-key/test/route.test.ts`) and `academy-trainer` (`noKeyInLogs.test.ts`, with the first route that calls the Trainer). ADR 0012 and ADR 0003 decide where keys come from. `accessErrorForStatus > classifies provider statuses` passes before any code (PR #96 built it), so it cannot be a G8 target: add it to the question of #63.
3. Once #101 is answered: the Naturalness Notes and the natural version in the Enrichment.
4. In protocol order (`docs/migration/MIGRATION_PROTOCOL.md` § Phases): 5e (Academy routes and screens), 5f (seam invariants and the `academy-spec` rows), Phase 6, Phase 7.
5. At any point, best before the next large unit: the cleanup in [Docs and tools that slow down or mislead agents](#docs-and-tools-that-slow-down-or-mislead-agents), as its own unit.

For steps 2 to 5, create the unit's issue first (`ready-for-agent` and a lane label), naming its ledger rows, sources and targets, as #102, #104 and #106 do.

Facts these units need that no issue records yet:

- No route uses the Trainer or the Academy services; `apps/server/src/index.ts` wires neither.
- 5e composes the services: `evaluateWriting(text, now, undefined, "practice")`, then `foldEvaluation(trainer, { evaluationId })`. `foldEvaluation` runs in one transaction and refuses a second fold of the same Evaluation, so a failed Enrichment can be retried alone.
- Grifando's daily session (`afterSessionId` in `exerciseService.ts` and `POST /api/exercises`) has no test at the service or the route: characterize it at the baseline before porting it.
- Progress still counts practice-origin Writing Samples in the finding rate; excluding them by default (ADR 0010) is a 5f invariant.
- The 5f lint rule against Academy imports of Evaluation write services must name the functions (`persistEvaluation`, `deleteEvaluation`, `evaluateWriting`): Academy code reads through `getEvaluation`, which shares a module with `persistEvaluation`.

## Owner instructions in force

Given by Jhefferson on 2026-11-14; the G12 waiver is also recorded on #5. They bind every session until an owner changes them.

- Proceed with the protocol autonomously. Ask the owners only through issues titled "Human feedback needed", labeled `needs-info` and `decision`, then move on to other work.
- G12 is waived: merge a pull request once every other check is green. Start no Codex or other harness to verify.
- Commits: small and conventional (`type(scope): subject`), with no AI mention and no `Co-Authored-By` or other trailer, even when the harness suggests one. Commit unsigned per command, `git -c commit.gpgsign=false commit ...`; leave the git configuration as it is.
- Pull request bodies: `Closes #N`, then `### Background` and `### Key Decisions`; a unit adds its mutation table. No dashes used as punctuation, no AI mention, no attribution footer.
- Reuse baseline code where it fits the stack. Open issues for the problems found, and solve the ones you can.
- After each merge, remove the merged branch's local worktree and branch. GitHub deletes merged heads itself, except `dev` (ruleset "Keep dev").
- End-to-end tests are paused: no new Playwright journeys, Vite dev-proxy cases or Docker smoke checks. The existing ones keep running and their rows stay open. In-process route tests (`app.request`) continue.
- Keep every checkout under one parent directory, `$F` below.

Levy (`levyrodrigues23`), the other owner, has three open owner actions: accept or amend the ADRs on #5, answer the decision requests, and settle steps 2 and 3 of `docs/migration/HANDOFF.md` (his Grifando clones; what Grifando may change until cutover). His own agent sessions claim units only through issue labels, after checking that no issue is `in-progress`, and leave the shared files (migrations, the contract index, CI workflows, `gates/baseline.json`, the ledger schema) to one coordinator, today Jhefferson's Claude Code session.

## Working setup

- `$F`, the parent directory (Jhefferson's: `/home/jheff/projects/personal/fluenshift`): `app` (the clone, on `main`), `app-wt/<unit>` (one worktree per unit), `app-wt/.pending/` (local tools, issue and pull request drafts), `app-baselines/{pe,grifando}` (the sources at their pins: `node scripts/migration/baselines.ts sync`).
- Toolchain and commands: `AGENTS.md` § Commands. The baselines' toolchains: `docs/migration/BASELINES.md`.
- Jhefferson's machine: Claude Code memory in `~/.claude/projects/-home-jheff-projects-personal-fluenshift-app/memory/`; a session hook makes chat replies terse, while text written to the repository and GitHub stays plain English; the interactive `grep` is ugrep, so scripts call `/usr/bin/grep`; `$F/app-verify/protocol-review` is an old checkout outside the migration.

A unit from issue to merge:

```sh
export PATH="$(mise exec node@26.13.0 pnpm@12.18.0 -- sh -c 'echo $PATH')"   # husky needs pnpm
gh issue edit <n> --repo Fluenshift/app --remove-label ready-for-agent \
  --add-label in-progress --add-label implementer:claude
git -C $F/app fetch -q origin && git -C $F/app worktree add $F/app-wt/wu<n> -b wu/<n>-<slug> origin/main
cd $F/app-wt/wu<n> && pnpm install --frozen-lockfile --prefer-offline
# commit 1: ported tests, typed stubs, and the migration they need; every target red
# commits 2 to n: the port, then the ledger targets
node scripts/migration/red-green.ts --base origin/main --head HEAD    # G8
node scripts/migration/parity-check.ts                                # G9, structure only
node scripts/migration/parity-audit.ts --root $F/app-baselines        # G10
pnpm verify
git push -u origin HEAD
gh pr create --draft --title "..." --body-file <body.md> --label implementer:claude
gh issue edit <n> --repo Fluenshift/app --remove-label in-progress --add-label in-review
setsid nohup bash $F/app-wt/.pending/tools/merge-when-green.sh <pr> > <log> 2>&1 < /dev/null & disown
gh issue edit <n> --repo Fluenshift/app --remove-label in-review      # after the merge closes it
```

Local tools, in `$F/app-wt/.pending/` on Jhefferson's machine only:

- `tools/merge-when-green.sh <pr>` ([appendix](#appendix-merge-when-greensh)): waits for the checks, ignoring `G12`; reruns a run whose only failures are the PGlite timeouts of #72, at most four times; then marks the pull request ready, merges it with a merge commit, and removes the clean local worktree and branch. Exits 1 when another check fails, 2 after 40 minutes.
- `mutation-tools/mutate.mjs <workspace> <mutations.json>`: applies each `{ file, from, to, tests }` alone, runs Vitest on `tests`, lists the tests that caught it, and restores the file.
- `mutation-tools/targets.mjs <repo> <slice> <report.json> <map.json>`: writes `targets` for rows whose verbatim titles passed in a Vitest JSON report.
- `tools/ledger-union.ts <repo> <ledger file>...`: during a merge conflict in `docs/migration/parity/`, keeps the union of both sides' rows and targets.

## Gotchas

Gates and process:

- G8 needs each target red at the pull request's first commit and green at its head. A target red on an error instead of an assertion passes with a note; stubs that return a wrong placeholder value fail on assertions. A ported test whose behavior already exists passes at the first commit and cannot be a target (#63); a new test that reuses an existing title fails G8.
- One database migration is in flight at a time. A unit that needs the previous unit's migration branches from that unit and runs `pnpm db:generate` after its merge (#106 did so from #104). Before a migration merges, regenerate it after a schema change; after, add a new one.
- Baseline behavior no test covers, including a mutation survivor, is characterized first: write the case in `migration/characterization/<system>/files/`, run `node scripts/migration/characterization-run.ts <system> --root $F/app-baselines`, then `inventory.ts --root $F/app-baselines` (confirm with `--check`), `ledger-add.ts --slice <slice> --class <A|B|C> <row id>`, and the table in `docs/migration/BASELINES.md` by hand. It goes in the unit's first commit.
- Edit ledger targets with a script that writes only `targets`: each row's `id` contains the test title, so a text replacement of a title also rewrites the `id`.
- G11 records lint, TypeScript, CI, Vitest, Playwright, Vite and oxfmt settings and the gate scripts. Only the coordinator records them again (`node scripts/check-gates.ts --write`), and a Vitest setting such as `testTimeout` needs an accepted ADR. `turbo.json` is not recorded.
- Generated files conflict between sibling units: for the ledger, `ledger-union.ts`; for reports and inventories, take theirs and rerun the scripts; for `BASELINES.md`, edit by hand.
- Retarget pull requests to `main` before deleting their base branch (`gh api -X PATCH repos/Fluenshift/app/pulls/N -f base=main`); GitHub closes them otherwise.
- Edit a pull request body with `gh api -X PATCH repos/Fluenshift/app/pulls/N -F body=@file`; `gh pr edit` fails on gh 2.46.
- A full CI run takes about 15 minutes. CodeQL rejects `randomBytes` with `%` (`js/biased-cryptographic-random`); use `randomInt`.

Stack:

- Starting the built server needs `DATA_DIRECTORY` (local profile) or `DATABASE_URL` (hosted).
- The server bundle keeps npm packages external: every npm package that bundled workspace code imports must also be a dependency of `apps/server`.
- pnpm 12 fails an install on a dependency build script nobody reviewed: list it in `allowBuilds`.
- Provider fakes over `fetch`: Anthropic names the model in the body and sends `x-api-key`; Google names it in the path (`/models/<id>:generateContent`) and sends `x-goog-api-key`, and a fake Google error needs `error.status` to map; OpenRouter reports in-body errors as an `APICallError` with status 200.
- With Effect's `TestClock`, move the clock only after the fake `fetch` has been called.
- Web tests import relatively: the `@/` alias would change `vite.config.ts`, which G11 records.

Effect 4.1.2 and lint:

- Tagged errors are `Schema.TaggedError<X, { readonly brand: unique symbol }>()`. Recover with `Effect.catch`, `Effect.catchIf`, `Effect.catchDefect` or `Effect.match`; a timeout fails with an error that `Cause.isTimeoutError` recognizes; `TestClock` comes from `effect/testing`.
- `Effect.fn` keeps a generator's type parameters, so a service can take an Effect-returning capability, as the interview takes the Judge's evaluation.
- Map Effects over an array with `pipe(array, Effect.forEach(f))`: oxlint flags `Effect.forEach(array, f)`, and the Effect diagnostics flag `Effect.all(array.map(f))`.
- Lint shapes code: one argument per `expect`; sequential promise chains recurse instead of looping with `await` or using `reduce` (see `foldInOrder` in `apps/server/src/academy/pattern-folding.ts`); arrow constants; plain `it` with `Effect.runPromise`, since `expect` inside `it.effect` is refused; `Promise.withResolvers` instead of `new Promise`; helpers that capture nothing at module scope.
- `packages/core` exports by path (`@fluenshift/core/<module>`).

Shell:

- Give `git worktree add` an absolute path: under `git -C $F/app`, a relative path lands inside the main checkout.
- Stop a process with `pgrep -f '<patter[n]>' | xargs -r kill`; a plain `pkill -f` matches the tool call's own shell.
- Write `\uXXXX` escapes from a script: typed into a tool input, they arrive as the real character.
- Start long waits detached (`setsid nohup ... & disown`) so they outlive the tool call.

## Docs and tools that slow down or mislead agents

Reviewed on 2026-11-16; every claim below was checked against the files. Items 1 to 4 change what every session reads, so do them first. All of them fit one docs unit with its own issue: they change no product behavior and no ledger row.

1. **Startup reading load.** `AGENTS.md` sends every session through this file, `docs/migration/HANDOFF.md`, `PRE_MIGRATION.md`, `MIGRATION_PROTOCOL.md`, `README.md` and `docs/adr/` before any work: about 1,700 lines plus 607 lines of ADRs, before `CONTEXT.md` and Effect's own notes. Most of it bears on no single unit. Fix: keep `AGENTS.md` as the always-read summary and turn the list into pointers that name when to read each document (for example, the ledger format before editing `docs/migration/parity/`; an ADR when a row cites it).
2. **Stale passages that contradict the current state.** `AGENTS.md` line 18 says the long documents win when they disagree with it, so these passages override current text:
   - `docs/migration/HANDOFF.md` lines 211 to 233 ("Next session") instruct an agent to verify the setup and start Phase 0; Phases 0 to 3 are done.
   - `docs/migration/PRE_MIGRATION.md` line 54 lists as still open the deploy model, the Judge's provider, analytics, demotion on a repeated mistake, Academy state across Rubric Versions, and practice offered or imposed; ADRs 0003, 0012, 0013, 0014, 0015 and 0016 decided them on 2026-11-14.
   - `docs/migration/MIGRATION_PROTOCOL.md` lines 32 and 513 require a cross-vendor G12 verdict on every change; the owners waived G12 (amendment to ADR 0001, #5).

   Fix: rewrite or delete these passages, then state the precedence that matches reality: accepted ADRs, then `AGENTS.md`, then the long documents.

3. **The same rules in four places.** The agent rules exist in `AGENTS.md` § Rules, `MIGRATION_PROTOCOL.md` § Agent rules (19 numbered rules), `PRE_MIGRATION.md` § Rules for the new repo's AGENTS.md, and the owner instructions above. Their numbering differs: the stop rule is step 8 of `AGENTS.md` § Work units, step 12 of the protocol's work unit cycle and the protocol's agent rule 16. Every edit must reach every copy, and a missed copy becomes a contradiction. Fix: keep the rules once, in `AGENTS.md`, move the owner instructions there, and replace the other copies with a pointer.
4. **An MCP server the repository itself distrusts.** `.mcp.json` registers `effect-docs` (`effect-mcp@0.1.16`), while `AGENTS.md` § Effect warns that this server mixes Effect 3 and release-candidate pages. The installed `node_modules/effect/AGENTS.md` and `ai-docs/` match Effect 4.1.2. Fix: remove the server from `.mcp.json`.
5. **Planning history inside the working protocol.** `MIGRATION_PROTOCOL.md` (822 lines) keeps material no unit uses: § Why — comparison (lines 85 to 141), the finished Phases 0 to 2 (176 to 373), § Evidence (711 to 788) and § Uncertainties (789 to 822). Fix: move them to an archive file or delete them (git keeps them), leaving the phases ahead, the work unit cycle, the gates and the definition of done.
6. **Tools that exist on one machine.** The four local tools above live outside the repository; another machine rebuilds them from prose, and this file carries one as a 60-line appendix. Fix: commit them under `scripts/migration/` (first check what `scripts/check-gates.ts` records), then delete the appendix.
7. **Conventions in the wrong file.** The Effect and lint gotchas above apply to every unit but live in a session file. Fix: move them into `AGENTS.md` § Effect, and keep only session state here.
8. **Large generated JSON.** The inventory (408 KB), the ledger (376 KB), the baseline reports (188 KB) and the characterization reports (448 KB) are data for scripts. Query one row at a time (`parity-check.ts`, or `node -e` over the parsed file) instead of opening a file.
9. **Claude Code memory on Jhefferson's machine.** A note claiming that `SESSION_HANDOFF.md` was untracked was corrected on 2026-11-16. After item 3, three of the five notes repeat instructions that `AGENTS.md` will hold; remove them then.

## To discuss: the checkout layout

Raised by Jhefferson on 2026-11-16. Nothing changes until the owners decide; decide before cleanup item 6, since the local tools depend on the layout.

Today `$F/app` is an ordinary clone kept on `main`, and each unit adds a git worktree of it, `git worktree add $F/app-wt/<unit>`. The worktrees share the clone's objects and refs (`git -C $F/app worktree list` shows them); each runs its own `pnpm install`, which takes seconds because the pnpm store is shared.

Frictions so far:

- The clone is special: it must stay on `main`, and `merge-when-green.sh` hard-codes its path.
- Under `git -C $F/app`, a relative worktree path once put a worktree inside the clone.
- Worktree directories (`wu106`) are named differently from their branches (`wu/106-interview`).

Options:

1. Keep the layout and fix the frictions: absolute paths, worktrees named after their branches, the tools moved into the repository.
2. A bare repository with every branch, `main` included, as a sibling worktree: `git clone --bare https://github.com/Fluenshift/app.git $F/app/.bare`, a `$F/app/.git` file containing `gitdir: ./.bare`, then `git config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'` (a bare clone does not set it, so `git fetch` would not update the other branches), then `git worktree add $F/app/main main` and one `git worktree add` per unit branch. No checkout is special.
3. The harness's own worktrees: Claude Code creates and removes worktrees itself (the `EnterWorktree` tool, and `isolation: "worktree"` for subagents); check its current docs for where it puts them. Codex has its own mechanism, so the two harnesses would differ.

Each option changes the pruning in `merge-when-green.sh`, the paths in this file, and Claude Code's memory note on the directory layout.

## To discuss: both owners on Claude Code

Raised by Jhefferson on 2026-11-16: Levy will probably run Claude Code too, not Codex. The process assumes two vendors in these places; decide each before Levy's first session:

- **Who holds a unit.** The labels `implementer:claude` and `implementer:codex` tell sessions apart by vendor, so two Claude Code sessions would look alike. Options: assign the issue to the account the session runs as (`gh issue edit <n> --add-assignee @me`), or one label per owner.
- **The coordinator.** Migrations, the contract index, CI workflows, `gates/baseline.json` and the ledger schema belong to one coordinator, today Jhefferson's Claude Code session. Agree who coordinates when both run, and how a unit announces a migration in flight.
- **G12.** Cross-vendor verification (ADR 0001, `scripts/migration/verdict-check.ts`, the "G12 verdict" workflow, the verdict format in `docs/migration/README.md`) is already waived. With one vendor, either retire it through an amendment to ADR 0001 or keep it informative. Retiring it also removes the Codex passages from the documents (cleanup item 3).
- **Per-machine context.** Claude Code memory and installed plugins are per machine: Levy's sessions see neither Jhefferson's memory notes nor, unless installed, the skills suggested below. Durable instructions belong in `AGENTS.md` (cleanup items 3 and 9).

## Suggested skills

For Claude Code sessions with the `mattpocock-skills` plugin installed; without it, skip this section.

- `mattpocock-skills:tdd`: every unit is tests first (commit 1 red, then green).
- `mattpocock-skills:code-review`: review the unit's diff against its issue before opening the pull request, since no human reviews code.
- `mattpocock-skills:pr`: draft the pull request body, then apply the owners' format above.
- `mattpocock-skills:writing-for-agents`: the docs cleanup, and any edit to `AGENTS.md`, this file or an issue meant for agents.
- `mattpocock-skills:domain-modeling`: when a unit adds a term to `CONTEXT.md` or drafts an ADR.
- `mattpocock-skills:diagnosing-bugs`: a gate or CI failure whose cause is unclear.
- `handoff`: at the end of the session, rewrite this file in the repository.

## Appendix: merge-when-green.sh

Kept here until the tool moves into the repository (cleanup item 6). Set `FLUENSHIFT_APP` to the main checkout of `Fluenshift/app` when it is not Jhefferson's path.

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
