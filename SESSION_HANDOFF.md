# Session handoff

Last updated 2026-11-16, in the sixth agent session. This file holds only what the repository and GitHub do not: the work in flight, the next steps and the facts they need. `AGENTS.md` holds the rules and how a unit runs. Rewrite this file at the end of every session, through a pull request.

## Work in flight

| Work | State | Details |
| --- | --- | --- |
| Lighter gates and shorter documents | waiting for an owner to accept ADR 0019 | PR #113 (closes #109), acceptance on #117 |
| 5d, second part: the interview | paused | #106 and its [comment of 2026-11-16](https://github.com/Fluenshift/app/issues/106#issuecomment-6906562621); branch `wu/106-interview` |
| Owner decisions | waiting | #5, #63, #66, #72, #87, #101, #110, #117, #119; each issue states its options and a recommendation |

Merged work: `git log --first-parent --oneline main`. The rows still open per slice are the last lines of the parity step in CI's test job, or of `pnpm parity` locally (needs Docker).

## Next steps

1. Once #117 accepts ADR 0019: set the ADR's status line and its row in `docs/adr/README.md` to Accepted, with a link to the acceptance comment, then merge #113. On Jhefferson's machine, delete the untracked `$F/app/mise.toml` first (the merge adds the tracked one), then remove the worktrees `$F/app-wt/wu109` and `$F/app-wt/wu106` (`git worktree remove`; both branches are pushed).
2. Finish #106 in the clone, following its comment of 2026-11-16: `git switch wu/106-interview`, then `git rebase origin/main`. Its pull request then runs the new workflow.
3. #118: bring the product documents in line with the code and the ADRs.
4. #111: move the three unit helpers into the repository.
5. The Trainer's keys (Phase 6 step 2), needed before any route calls the Trainer. Rows: `hosted` (`credentials.test.ts`, `ai-key/test/route.test.ts`) and `academy-trainer` (`noKeyInLogs.test.ts`, with the first route that calls the Trainer). ADR 0012 and ADR 0003 decide where keys come from. `accessErrorForStatus > classifies provider statuses` passes before any code (PR #96 built it), so it cannot be a G8 target: add it to the question of #63.
6. Once #101 is answered: the Naturalness Notes and the natural version in the Enrichment.
7. In protocol order (`docs/migration/MIGRATION_PROTOCOL.md`, Phases): 5e, 5f, Phase 6, Phase 7.

Facts these units need that no issue records yet:

- No route uses the Trainer or the Academy services; `apps/server/src/index.ts` wires neither.
- 5e composes the services: `evaluateWriting(text, now, undefined, "practice")`, then `foldEvaluation(trainer, { evaluationId })`. `foldEvaluation` runs in one transaction and refuses a second fold of the same Evaluation, so a failed Enrichment can be retried alone.
- Grifando's daily session (`afterSessionId` in `exerciseService.ts` and `POST /api/exercises`) has no test at the service or the route: characterize it at the baseline before porting it.
- Progress still counts practice-origin Writing Samples in the finding rate; excluding them by default (ADR 0010) is a 5f invariant.
- The 5f lint rule against Academy imports of Evaluation write services must name the functions (`persistEvaluation`, `deleteEvaluation`, `evaluateWriting`): Academy code reads through `getEvaluation`, which shares a module with `persistEvaluation`.
- The server's persistence tests copy one migrated PGlite template per test (#112), kept in the system temporary directory under a hash of the migrations and the lockfile. A new migration builds a new template on the next run.

CI speed, measured on 2026-11-16: a product pull request took 3.4 minutes before this session. The new workflow (#113) runs each suite once, #114 cut the server suite from 66 to about 23 seconds in CI, and #116 runs the Docker smoke beside it. Measure the next runs before changing CI again.

## Local helpers, until #111

In `$F/app-wt/.pending/` on Jhefferson's machine only:

- `mutation-tools/mutate.mjs <workspace> <mutations.json>`: applies each `{ file, from, to, tests }` alone, runs Vitest on `tests`, lists the tests that caught it, and restores the file.
- `mutation-tools/targets.mjs <repo> <slice> <report.json> <map.json>`: writes `targets` for rows whose verbatim titles passed in a Vitest JSON report.
- `tools/ledger-union.ts <repo> <ledger file>...`: during a merge conflict in `docs/migration/parity/`, keeps the union of both sides' rows and targets.

## Jhefferson's machine

- `$F` is `/home/jheff/projects/personal/fluenshift`. `$F/app-verify/protocol-review` is an old checkout outside the migration.
- Claude Code keeps its memory in `~/.claude/projects/-home-jheff-projects-personal-fluenshift-app/memory/`. A session hook makes chat replies terse; text written to the repository and to GitHub stays plain English.
- The interactive `grep` is ugrep, so one-liners call `/usr/bin/grep`.
