# 0019. Lighter gates and shorter documents for one harness

- Status: Proposed on [#117](https://github.com/Fluenshift/app/issues/117).
- Amends ADR 0001 (decisions 4, 6 and 7) and `MIGRATION_PROTOCOL.md`. No ledger row changes.

## Context

The protocol was written for two vendors, several parallel implementers and a merge queue. One
Claude Code session does the work, and both owners plan to use Claude Code. Measured on
2026-11-16:

- A CI run took 2.5 to 5.1 minutes and about 13 runner-minutes. Every Vitest suite ran three
  times in it (the `verify`, `parity` and gate self-test jobs), and the Docker image was built
  three times. The slowest job tested the gates themselves on every pull request, including one
  that changed only Markdown.
- The G12 workflow ran on every pull request and every issue comment, and left a failing `G12`
  status on each pull request, two days after the owner waived the gate.
- The merge queue was never configured. The `main` ruleset blocks deletion and force pushes, and
  requires neither a pull request nor a check: a local script waited for the checks by choice.
- `AGENTS.md` sent every session through about 26,600 words and gave the long documents
  precedence over itself, although they were the stale ones. The agent rules lived in four
  places under three numberings. About 230 of the 822 lines of `MIGRATION_PROTOCOL.md` were live
  and unique.
- Every unit worked in its own git worktree under `app-wt/`, a rule written for parallel
  implementers, and every command needed a `mise exec` prefix because nothing in the repository
  selected Node 26 and pnpm 12.

## Decision

1. **G12 is retired.** The `G12 verdict` workflow, `verdict-check.ts`, its tests and its
   self-test cases go. No status that is expected to fail stays on a pull request. The assignee
   of an issue names who holds the unit, and the pull request that closes it is its review: the
   labels `implementer:<vendor>`, `in-progress` and `in-review` are no longer applied.
2. **Each suite runs once per CI run.** One job runs every Vitest suite with a report, the Docker
   smoke included, and G9 reads those reports. The static checks run in a job of their own. When
   a gate changes, the gate self-tests run the suites a second time in their own job.
3. **A change that is only Markdown outside the workspaces runs the static checks and G7
   alone.** The static checks include the documented commands and the ledger's structure, which
   reads the ADR status lines. Markdown inside a workspace, the ledger and the inventory count
   as code.
4. **The gate self-tests run when a gate changes**: a script, a gate's configuration, the
   toolchain, the records the cases read, or a file that a case edits or runs.
   `scripts/ci-changes.ts` holds the list. A manual run of the workflow runs them too.
5. **No merge queue and no ruleset.** The `merge_group` triggers go. The owner declined a `main`
   ruleset on 2026-11-16 (ADR 0001, decision 6): sessions change `main` only by merging a pull
   request whose checks are green, and never push to it (`AGENTS.md`). The run on every push to
   `main` stays: it is the only check of `main` after two pull requests merge one after the
   other. Two `gh` commands, one that waits for the checks and one that merges, replace the local
   script that polled them.
6. **G11 records each workflow and the path classifier line by line.** A workflow line can skip a
   job, so G11 keeps every line of each workflow under the name of its job, and every line of
   `scripts/ci-changes.ts`. Any edit to them fails `pnpm check:gates` until the coordinator
   records the baseline again.
7. **Rules live once, and the newest text wins.** `AGENTS.md` holds the agent rules, the owners'
   standing instructions and the work unit cycle. Precedence: an accepted ADR, then `AGENTS.md`,
   then the other documents. `AGENTS.md` names when to read each of them, instead of listing
   them all as required reading.
8. **Working documents hold the work ahead.** `MIGRATION_PROTOCOL.md` keeps the baselines, the
   open phases, the gates and the definition of done. `HANDOFF.md` and `PRE_MIGRATION.md` are
   deleted, and what is still live in them moves. The planning history stays in git: commit
   `39fbb46` holds the full text of all three.
9. **Tools live in the repository.** The local helpers that units still use move under
   `scripts/` (#111), and `SESSION_HANDOFF.md` stops carrying a script as an appendix. The
   `effect-docs` MCP server goes, and `.mcp.json` with it: `AGENTS.md` already told agents not to
   trust it. `mise.toml` pins Node and pnpm, so commands need no prefix.
10. **One checkout.** A unit is a branch in the clone. A second session at the same time uses
    Claude Code's own `claude --worktree`, whose checkouts under `.claude/worktrees/` git, lint
    and format ignore.

## Consequences

- `gates/baseline.json` is recorded again. By the letter of G11 the new baseline is weaker: the
  `merge_group` trigger and the `verdict.yml` workflow are gone, `pnpm test` and
  `pnpm docker:smoke` no longer run as steps of their own, and new `if` conditions skip jobs. No
  check of product code is removed: every suite, the Docker smoke and G1 to G11 still run on
  every change that can affect them, and decision 6 makes G11 stricter than before on the
  workflow itself.
- Accepted risk: a change that makes a self-test case stale without touching a listed file is
  found at the next gate change, not on its own pull request.
- Nothing on GitHub stops a merge with failing checks or a direct push to `main`, as before: the
  rule in `AGENTS.md` is the guard.
- ADR 0001's decision 4 (cross-vendor verification, waived at acceptance) and its informative
  `G12` status end here. Its decision 6 (asking for a ruleset) is settled by the owner's answer.
  Its decision 7 changes: the self-tests still run as one CI job, but not on every run.

## Alternatives

- Keep G12 as information: a status that fails on every pull request teaches sessions to ignore
  failing statuses.
- A merge queue: a second full CI run per pull request, with nothing to queue while one or two
  sessions work.
- A ruleset that requires a pull request and the checks: proposed, and declined by the owner.
- An archive folder for the planning history: agents still find and read it, and git already
  keeps it.
- Keep the self-tests on every pull request: they set the wall-clock time of every run to prove
  something that changes only when a gate does.
