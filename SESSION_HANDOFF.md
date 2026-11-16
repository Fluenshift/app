# Session handoff

Last updated 2026-11-16, in the sixth agent session. This file holds only what the repository and GitHub do not: the work in flight, the next steps and the facts they need. `AGENTS.md` holds the rules and how a unit runs. Rewrite this file at the end of every session, through a pull request.

## Work in flight

Nothing besides this handoff, which ships with ADR 0020 (#123): sessions decide and merge, and nothing waits on an owner. The requests that waited on owners are decided there and closed.

Merged work: `git log --first-parent --oneline main`. The rows still open per slice are the last lines of the parity step in CI's test job, or of `pnpm parity` locally (needs Docker).

## Next steps

1. **Provisional Rubric Version** (decided in ADR 0020, from #87): new Evaluations record a version distinct from PE's `"1"`, for example `"1-provisional"`, until live calibration passes; the Judge's prompt and the rubric policy stay as they are. Find every place that records or asserts the version (`RUBRIC_VERSION` in `packages/core/src/rubric-v1.ts`, `apps/server/src/evaluation/writing-evaluation.ts`, the Judge's prompt). A ported test that asserts `"1"` on a new Evaluation changes under ADR 0020: its row becomes `port-changed` with `decision: "adr:0020"`.
2. **Two Progress rows** (decided in ADR 0020, from #66): port `Progress endpoints > selects evidence by insight, Error Category or correction` and `... refuses an unknown insight, an unknown category, a half correction and a bad period` of `app.characterization.test.ts` (`evaluation-http`, now `port-changed` under ADR 0008), with the Correction in the body of `POST /api/progress/evidence` (`ProgressEvidenceRequest`).
3. #111: move the three unit helpers into the repository.
4. #120: give each product rule one home in the documents.
5. **Naturalness Notes** (decided in ADR 0020, from #101): add the natural version and the Naturalness Notes to the Enrichment (AR-03, AR-04). A note grows its Mistake Pattern's occurrence count and is never a failed recall.
6. **The Trainer's keys** (Phase 6 step 2), needed before any route calls the Trainer. Rows: `hosted` (`credentials.test.ts`, `ai-key/test/route.test.ts`) and `academy-trainer` (`noKeyInLogs.test.ts`, with the first route that calls the Trainer). ADR 0012 and ADR 0003 decide where keys come from. `accessErrorForStatus > classifies provider statuses` passes before any code (PR #96 built it), so it cannot be a G8 target: mark it `superseded` under an ADR, as ADR 0020 did for #63.
7. In protocol order (`docs/migration/MIGRATION_PROTOCOL.md`, Phases): 5e (Academy routes and screens), 5f (seam invariants and the `academy-spec` rows), Phase 6, Phase 7.

Facts these units need that no issue records yet:

- No route uses the Trainer or the Academy services; `apps/server/src/index.ts` wires neither.
- 5e composes the services: `evaluateWriting(text, now, undefined, "practice")`, then `foldEvaluation(trainer, { evaluationId })`. `foldEvaluation` runs in one transaction and refuses a second fold of the same Evaluation, so a failed Enrichment can be retried alone. The interview (#122) takes the evaluation as a function: `answerTurn(evaluate, trainer, input)`.
- Grifando's daily session (`afterSessionId` in `exerciseService.ts` and `POST /api/exercises`) has no test at the service or the route: characterize it at the baseline before porting it.
- Progress still counts practice-origin Writing Samples in the finding rate; excluding them by default (ADR 0010) is a 5f invariant.
- The 5f lint rule against Academy imports of Evaluation write services must name the functions (`persistEvaluation`, `deleteEvaluation`, `evaluateWriting`): Academy code reads through `getEvaluation`, which shares a module with `persistEvaluation`.
- A Mistake Pattern keeps its counts and example after the Evaluation behind them is deleted; removing that derived state is a 5f invariant (`DATA-POLICY.md`, Deletion).
- The server's persistence tests copy one migrated PGlite template per test (#112), kept in the system temporary directory under a hash of the migrations and the lockfile. A new migration builds a new template on the next run.

CI, measured on 2026-11-16: a pull request that changes product code takes about 2.3 minutes, one that changes a gate about 2.8, and one that changes only Markdown outside the workspaces runs the static checks and G7 alone. Measure before changing CI again.

## Owner steps

Sessions never do these (`AGENTS.md`, Rules): they cannot be undone outside this repository, or they cost money.

- Archive `Fluenshift/prompt-evolution`; its pin was verified on 2026-11-12.
- Levy: point local Grifando clones at `https://github.com/Fluenshift/grifando.git`; reconnect Grifando's Vercel project to the organization and give its CI a `GITLEAKS_LICENSE` secret, if Grifando still deploys from there.
- Set a budget before live calibration (G13) runs.
- Give the go-ahead for cutover (Phase 7).
- Say where Grifando's visual style came from, for `docs/product/ASSET-LICENSES.md` (#119, question 4).

## Local helpers, until #111

In `$F/app-wt/.pending/` on Jhefferson's machine only:

- `mutation-tools/mutate.mjs <workspace> <mutations.json>`: applies each `{ file, from, to, tests }` alone, runs Vitest on `tests`, lists the tests that caught it, and restores the file.
- `mutation-tools/targets.mjs <repo> <slice> <report.json> <map.json>`: writes `targets` for rows whose verbatim titles passed in a Vitest JSON report.
- `tools/ledger-union.ts <repo> <ledger file>...`: during a merge conflict in `docs/migration/parity/`, keeps the union of both sides' rows and targets.

## Jhefferson's machine

- `$F` is `/home/jheff/projects/personal/fluenshift`. `$F/app-verify/protocol-review` is an old checkout outside the migration.
- Claude Code keeps its memory in `~/.claude/projects/-home-jheff-projects-personal-fluenshift-app/memory/`. A session hook makes chat replies terse; text written to the repository and to GitHub stays plain English.
- The interactive `grep` is ugrep, so one-liners call `/usr/bin/grep`.
