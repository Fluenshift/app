# Session handoff

Last updated 2026-11-16, in the sixth agent session. This file holds only what the repository and GitHub do not: the work in flight, the next steps and the facts they need. `AGENTS.md` holds the rules and how a unit runs. Rewrite this file at the end of every session, through a pull request.

## Work in flight

| Work | State | Details |
| --- | --- | --- |
| Lighter gates and shorter documents | in review; merges once an owner accepts ADR 0019 | #109 |
| 5d, second part: the interview | paused | #106 and its [comment of 2026-11-16](https://github.com/Fluenshift/app/issues/106#issuecomment-6906562621); branch `wu/106-interview` |
| Owner decisions | waiting | #5, #63, #66, #72, #87, #101, #110; each issue states its options and a recommendation |

Merged work: `git log --first-parent --oneline main`. Open ledger rows per slice: `node scripts/migration/parity-check.ts`.

## Next steps

1. After #109 merges: an owner extends the `main` ruleset as ADR 0019 (decision 6) states. Agents never change a ruleset.
2. Finish #106, following its comment of 2026-11-16. Rebase the branch on `main` first, so that its pull request runs the new workflow. Jhefferson's machine still has the worktree `$F/app-wt/wu106`; elsewhere, `git -C $F/app worktree add $F/app-wt/wu106 wu/106-interview`.
3. #111: move the three unit helpers into the repository.
4. The Trainer's keys (Phase 6 step 2), needed before any route calls the Trainer. Rows: `hosted` (`credentials.test.ts`, `ai-key/test/route.test.ts`) and `academy-trainer` (`noKeyInLogs.test.ts`, with the first route that calls the Trainer). ADR 0012 and ADR 0003 decide where keys come from. `accessErrorForStatus > classifies provider statuses` passes before any code (PR #96 built it), so it cannot be a G8 target: add it to the question of #63.
5. Once #101 is answered: the Naturalness Notes and the natural version in the Enrichment.
6. In protocol order (`docs/migration/MIGRATION_PROTOCOL.md`, Phases): 5e, 5f, Phase 6, Phase 7.
7. #112, at any point: the server tests open one PGlite database per test case, which is most of a CI run.

Facts these units need that no issue records yet:

- No route uses the Trainer or the Academy services; `apps/server/src/index.ts` wires neither.
- 5e composes the services: `evaluateWriting(text, now, undefined, "practice")`, then `foldEvaluation(trainer, { evaluationId })`. `foldEvaluation` runs in one transaction and refuses a second fold of the same Evaluation, so a failed Enrichment can be retried alone.
- Grifando's daily session (`afterSessionId` in `exerciseService.ts` and `POST /api/exercises`) has no test at the service or the route: characterize it at the baseline before porting it.
- Progress still counts practice-origin Writing Samples in the finding rate; excluding them by default (ADR 0010) is a 5f invariant.
- The 5f lint rule against Academy imports of Evaluation write services must name the functions (`persistEvaluation`, `deleteEvaluation`, `evaluateWriting`): Academy code reads through `getEvaluation`, which shares a module with `persistEvaluation`.

## Local helpers, until #111

In `$F/app-wt/.pending/` on Jhefferson's machine only:

- `mutation-tools/mutate.mjs <workspace> <mutations.json>`: applies each `{ file, from, to, tests }` alone, runs Vitest on `tests`, lists the tests that caught it, and restores the file.
- `mutation-tools/targets.mjs <repo> <slice> <report.json> <map.json>`: writes `targets` for rows whose verbatim titles passed in a Vitest JSON report.
- `tools/ledger-union.ts <repo> <ledger file>...`: during a merge conflict in `docs/migration/parity/`, keeps the union of both sides' rows and targets.

## Jhefferson's machine

- `$F` is `/home/jheff/projects/personal/fluenshift`. `$F/app-verify/protocol-review` is an old checkout outside the migration.
- Claude Code keeps its memory in `~/.claude/projects/-home-jheff-projects-personal-fluenshift-app/memory/`. A session hook makes chat replies terse; text written to the repository and to GitHub stays plain English.
- The interactive `grep` is ugrep, so one-liners call `/usr/bin/grep`.
