# 0019. Lighter gates and shorter documents for one harness

- Status: Proposed on [#109](https://github.com/Fluenshift/app/issues/109).
- Amends ADR 0001 (decisions 4 and 7) and `MIGRATION_PROTOCOL.md`. No ledger row changes.

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

## Decision

1. **G12 is retired.** The `G12 verdict` workflow, `verdict-check.ts`, its tests and its
   self-test cases go. No status that is expected to fail stays on a pull request. The assignee
   of an issue names who holds the unit, and the pull request that closes it is its review: the
   labels `implementer:<vendor>`, `in-progress` and `in-review` are no longer applied.
2. **Each suite runs once per CI run.** One job runs every Vitest suite with a report, the Docker
   smoke included, and G9 reads those reports. The static checks run in a job of their own.
3. **A change that is only Markdown runs the static checks and the secret scan alone.** The
   static checks include the documented commands and the ledger's structure, which reads the ADR
   status lines. The ledger and the inventory are JSON and count as code.
4. **The gate self-tests run when a gate changes**: a script, a gate's configuration, the
   toolchain, or a file that a self-test edits or runs. `scripts/ci-changes.ts` holds the list.
   A manual run of the workflow runs them too.
5. **No merge queue.** The `merge_group` triggers go. One job, `CI`, sums a run up: it passes
   when every other job passed or was skipped under decisions 3 and 4.
6. **The `main` ruleset enforces the gates.** An owner adds three rules (ADR 0001, decision 6): a
   pull request before merging, with no approval required; the status check `CI`; and a branch
   that is up to date with `main`. A pull request is then always tested on the commit it merges
   into, so the run on every push to `main` goes once the rules are active. Two `gh` commands,
   one that waits for the checks and one that merges, replace the local script that polled them.
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
   trust it.

## Consequences

- `gates/baseline.json` is recorded again. By the letter of G11 the new baseline is weaker: the
  `merge_group` trigger and the `verdict.yml` workflow are gone, `pnpm test` and
  `pnpm docker:smoke` no longer run as steps of their own, and four `if` conditions are new. No
  check of product code is removed: every suite, the Docker smoke and G1 to G11 still run on
  every change that can affect them.
- Accepted risk: a change that makes a self-test case stale without touching a listed file is
  found at the next gate change, not on its own pull request.
- Until an owner applies decision 6, nothing on GitHub stops a merge with failing checks or a
  direct push to `main`, as before.
- ADR 0001's decision 4 (cross-vendor verification, waived at acceptance) and its informative
  `G12` status end here. Its decision 7 changes: the self-tests still run as one CI job, but not
  on every run.

## Alternatives

- Keep G12 as information: a status that fails on every pull request teaches sessions to ignore
  failing statuses.
- A merge queue: a second full CI run per pull request, with nothing to queue while one or two
  sessions work.
- An archive folder for the planning history: agents still find and read it, and git already
  keeps it.
- Keep the self-tests on every pull request: they set the wall-clock time of every run to prove
  something that changes only when a gate does.
