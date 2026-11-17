# Session handoff

Last updated 2026-11-17, at the end of the sixth agent session. This file holds only what the repository and GitHub do not: the work in flight, the next steps and the facts they need. `AGENTS.md` holds the rules and how a unit runs. Rewrite this file at the end of every session, through a pull request.

## Work in flight

Nothing besides this handoff. The last unit, #144 (`POST /api/exercises`), merged.

Merged work: `git log --first-parent --oneline main`. The rows that still wait for a target, one per line with their slice:

```sh
node -e 'const fs=require("fs");const d="docs/migration/parity/";for(const f of fs.readdirSync(d))for(const r of JSON.parse(fs.readFileSync(d+f)).rows)if(r.disposition.startsWith("port")&&r.targets.length===0)console.log(f,r.id)'
```

On 2026-11-17 there were 101: `academy-http` 18, `academy-web` 10, `academy-spec` 9, `academy-trainer` 2, `hosted` 52, and 10 paused end-to-end rows (the 4 dev-proxy cases of `evaluation-http`, the 6 rows of `evaluation-e2e`), which stay open.

## Next steps

1. **Attempt routes** (`academy-http`, the 6 rows of `attempts.characterization.test.ts`, class C): `POST /api/exercises/:exerciseId/attempts` and `POST /api/exercises/:exerciseId/attempts/:attemptId/explanation`. Sources: `migration/characterization/grifando/files/src/app/api/exercises/[id]/attempts/attempts.characterization.test.ts`, and Grifando's two `route.ts` files under `src/app/api/exercises/[id]/attempts/`. The services exist in `apps/server/src/academy/exercise-service.ts`: `submitAttempt(exerciseId, learnerAnswer)` fails with `NotFoundError`, and `explainAttempt(trainer, { attemptId, exerciseId })` returns `null` for an unknown attempt. The explanation route resolves the key before it reads the attempt; its own failures answer 502 for an invalid Trainer response and 500 otherwise, with the message of the characterization test.
2. **Interview routes** (`academy-http`, the 6 rows of `interview.characterization.test.ts`, `port-changed`): the service is `apps/server/src/academy/interview-service.ts`; each row's `decision` says what changes.
3. **Page reads** (`academy-http`, the 6 rows of `pages.characterization.test.ts`): what `/`, `/mistakes`, `/today`, `/vocabulary` and `/write` read; each row's `decision` says how it ports.
4. **`specimenData`** (`academy-web`, 10 rows, `port-changed` under ADR 0004).
5. #111, #120, then the **Naturalness Notes** (decided in ADR 0020, from #101): add the natural version and the Naturalness Notes to the Enrichment (AR-03, AR-04). A note grows its Mistake Pattern's occurrence count and is never a failed recall.
6. In protocol order (`docs/migration/MIGRATION_PROTOCOL.md`, Phases): 5f (the seam invariants below and the 9 `academy-spec` rows: seven Grifando fix commits and Grifando issues 77 and 78), Phase 6 (`hosted`), Phase 7.

Facts these units need that no issue records yet:

- A route that calls the Trainer takes it from `trainerForRequest(headers)` (`apps/server/src/academy/academy-requests.ts`): the request headers, else the local profile's configured key, else `TrainerKeyRequiredError`. The route's edge answers access errors through `TRAINER_FAILURES` (`apps/server/src/academy/trainer/credentials.ts`); an edge handler takes an `unexpected` failure (`apps/server/src/edge.ts`) when a route keeps its source's 500 message.
- Academy route tests follow `apps/server/src/academy/exercise-routes.test.ts`: a real PGlite database, the `x-test-learner` header picks the Learner, a fake `TrainerClient` layer, and `TrainerConfig` read from an empty environment.
- G7 accepts only the path parameters ADR 0023 lists (`PATH_PARAMETERS` in `scripts/check-url-text.ts`); a new one needs an ADR.
- The first Academy route that posts practice writing also ports `noKeyInLogs.test.ts` (`academy-trainer`, 2 rows). The rate limiter rows wait for the hosted request pipeline (Phase 6).
- Practice writing composes the services: `evaluateWriting(text, now, undefined, "practice")`, then `foldEvaluation(trainer, { evaluationId })`. `foldEvaluation` runs in one transaction and refuses a second fold of the same Evaluation, so a failed Enrichment can be retried alone. The interview takes the evaluation as a function: `answerTurn(evaluate, trainer, input)`.
- 5f invariants: Progress stops counting practice-origin Writing Samples in the finding rate by default (ADR 0010); a Mistake Pattern loses the counts and example of a deleted Evaluation (`DATA-POLICY.md`, Deletion); the lint rule against Academy imports of Evaluation write services names the functions (`persistEvaluation`, `deleteEvaluation`, `evaluateWriting`), because Academy code reads through `getEvaluation`, which shares a module with `persistEvaluation`.
- The server's persistence tests copy one migrated PGlite template per test (#112), kept in the system temporary directory under a hash of the migrations and the lockfile. A new migration builds a new template on the next run.
- CI runs the gate self-tests, about 2 more minutes, when a pull request changes a gate or a file in `SELF_TEST_FIXTURES` (`scripts/gate-selftest.ts`), `apps/server/src/edge.ts` among them.

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
