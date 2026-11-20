# Session handoff

Last updated 2026-11-20, at the end of the eighth agent session. This file holds only what the repository and GitHub do not: the work in flight, the next steps and the facts they need. `AGENTS.md` holds the rules and how a unit runs. Rewrite this file at the end of every session, through a pull request.

## Work in flight

Nothing besides this handoff. This session ran the Academy UI (Phase 5e) to its last open unit. ADR 0025 (PR #157) decides how a Grifando page read ports, and ADR 0026 (PR #179) decides practice writing's route and results and how Academy routes log an unexpected failure. Merged screens and units, each with its issue: `/today` (#158, PR #164), `/write`'s Practice Prompt (#159, PR #165), `/vocabulary` (#161, PR #166), `/mistakes` (#162, PR #167), `/academy` (#163, PR #168), `/exercises` (#169, PR #174), `/technical` (#175, PR #176), the practice writing route with the logs of #149 (#180, PR #181), practice writing on `/write` and `/today` with today's review (#160 and #170, PR #182), `/interview` (#171, PR #183), the Academy's own navigation (#177, PR #184) and the landing specimen (#173, PR #185).

Merged work: `git log --first-parent --oneline main`. The rows that still wait for a target, one per line with their slice:

```sh
node -e 'const fs=require("fs");const d="docs/migration/parity/";for(const f of fs.readdirSync(d))for(const r of JSON.parse(fs.readFileSync(d+f)).rows)if(r.disposition.startsWith("port")&&r.targets.length===0)console.log(f,r.id)'
```

On 2026-11-20 there were 71: `academy-spec` 9, `hosted` 52, and 10 paused end-to-end rows (the 4 dev-proxy cases of `evaluation-http`, the 6 rows of `evaluation-e2e`), which stay open.

## Next steps

1. #172, AR-17's Finding-based trend on the Academy dashboard, the last open unit of Phase 5e. Choose the measure first, in an ADR: "directional improvement claims" are out of scope (`docs/product/REQUIREMENTS.md`), so the dashboard shows values with their counts (FR-18), never "improving". Practice-origin Writing Samples leave the default finding rate in 5f (ADR 0010), so the measure must say which samples it covers. Then run `code-review` for Phase 5e.
2. #147 (two Dependabot alerts on development dependencies), #111, #120, then the **Naturalness Notes** (decided in ADR 0020, from #101): add the natural version and the Naturalness Notes to the Enrichment (AR-03, AR-04). A note grows its Mistake Pattern's occurrence count and is never a failed recall. The Academy's results and interview feedback then show the natural version (ADR 0026, decision 3), and `MistakeCard` already labels a note "Unnatural".
3. In protocol order (`docs/migration/MIGRATION_PROTOCOL.md`, Phases): 5f (the seam invariants below and the 9 `academy-spec` rows: seven Grifando fix commits and Grifando issues 77 and 78), Phase 6 (`hosted`, 52 rows, which matter once the owners want a public deploy, and Grifando's remaining pages: `/explain-code`, `/settings` with BYOK, `/privacy`), Phase 7. Run `code-review` at the end of each phase.

Facts these units need that no issue records yet:

- Academy screens (ADR 0025): each page read is a Hono `GET` route plus an SPA route. `PageShell` carries the Academy's own navigation (`AcademyNav`), so a new Academy screen gets it by using `PageShell`, and its entry goes in `NAV_LINKS`. The screens call the server through the `AcademyClient` (`apps/web/src/features/academy/academy-client.ts`): over HTTP in `apps/web/src/api.ts`, and in the screen tests through `createInMemoryAcademyClient`, which answers from fixtures and records save, generation and Attempt requests. `createAppRouter` defaults to `unavailableAcademyClient`, so the Evaluation screen tests stay unchanged. A component reads the client with `useRouteContext({ from: "__root__" })`. A failed Academy request is an `AcademyRequestError` with the route's code and its message, which Grifando's screens show; `isKeyRequired` spots `AI_KEY_REQUIRED`.
- Page read route tests live in `apps/server/src/academy/page-routes.test.ts`, with seed helpers for patterns, practice or work Evaluations with one Finding per Occurrence, Attempts and vocabulary items, and the clock fixed with `vi.useFakeTimers({ now, toFake: ["Date"] })`. Each new route's `DatabaseError` entry has its own "answers the generic 500" case.
- Grifando's client components port from source (ADR 0025, decision 5): its Vitest ran without a DOM, so no baseline test renders them. Screen tests assert Grifando's copy, roles and calls.
- Key handling in the local profile: no key travels from the browser. The server uses its configured Trainer key or answers 401 `AI_KEY_REQUIRED`, which shows Grifando's key notice pointing at Setup & privacy. Grifando's browser key store arrives with BYOK in Phase 6.
- Lint shapes React code: the React Compiler rule refuses `try`/`finally` in a component; the promise rules refuse `.then(onOk, onError)` with an `error` parameter and callbacks inside `.then`, so a component awaits a module-level async helper that catches (`toQueueState` in `exercise-practice.tsx`); `<output>` replaces `role="status"` and `<fieldset>` replaces `role="group"`; a handler passed as `onClick={props.onX}` must be wrapped in an arrow; no nested ternaries; regular expressions take the `u` flag; no member access on an `await` expression. TanStack route options go in the order `validateSearch`, `loaderDeps`, `loader`, `component`, which type inference also needs.
- Hono's typed client takes no `json` for a route with path parameters that reads its body itself: send the body through `init` (`submitAttempt` in `api.ts`). A typed `Link` needs an existing route, so a link to a screen not yet ported waits for it.
- Grifando's category breakdown orders by count only: a tie keeps no order, and tests do not assert one.
- Practice writing is `POST /api/practice-writing` (ADR 0026): `practiceWritingFor` in `apps/server/src/practice/practice-writing.ts` resolves the key, runs `evaluatePractice`, and answers the Evaluation with the Occurrences the Enrichment recorded (`listOccurrencesForEvaluation`). Academy screens show a practice Evaluation through `WritingResults` and `TurnFeedback` in `apps/web/src/features/academy/`.
- `makeEdge` takes a `log` context: an unexpected failure logs one error-level line with the context and the error's tag or name, never its message (ADR 0026). Every Academy route names one; a new Academy route needs one too. `practice-writing-routes.test.ts` shows how a test keeps the runtime's log lines (`Logger.layer` with `Logger.formatStructured`).
- A route that calls the Trainer takes it from `trainerForRequest(headers)` (`apps/server/src/academy/academy-requests.ts`): the request headers, else the local profile's configured key, else `TrainerKeyRequiredError`. Each such route has a helper that resolves the key before it reads anything: `generateExercisesFor`, `explainAttemptFor`, `startInterviewFor` there, and `answerInterviewTurnFor` in `apps/server/src/practice/practice-writing.ts`. The route's edge answers access errors through `TRAINER_FAILURES` (`apps/server/src/academy/trainer/credentials.ts`), and takes an `unexpected` failure (`apps/server/src/edge.ts`) when it keeps its source's 500 message (`SOMETHING_WENT_WRONG`, `EXPLANATION_FAILED` in `app.ts`). `NOT_FOUND` is Grifando's 404 body.
- Academy route tests follow `apps/server/src/academy/exercise-routes.test.ts` or `interview-routes.test.ts`: a real PGlite database, the `x-test-learner` header picks the Learner, a fake `TrainerClient` layer, and `TrainerConfig` read from an empty environment. Grifando's mocked `createAIProvider` maps onto that fake Trainer (`docs/migration/README.md`, Mechanical mapping).
- A route's error entries need a case when no source test covers them, or a remapped answer passes every gate. `POST /api/exercises` still maps a refused Trainer answer to the generic 500 with no case.
- G7 accepts only the path parameters ADR 0023 lists (`PATH_PARAMETERS` in `scripts/check-url-text.ts`); a new one needs an ADR. Filters and prompt choices stay in the SPA's own URL (ADR 0025).
- The rate limiter rows wait for the hosted request pipeline (Phase 6), with Grifando's `ensureUser` (`hosted`, `rateLimitFirst`).
- Practice writing composes outside the Academy, in `apps/server/src/practice/practice-writing.ts`: `evaluatePractice` runs the Judge with the practice origin, then `foldEvaluation`; ADR 0024 and ADR 0026 set the failure answers. `foldEvaluation` runs in one transaction and refuses a second fold of the same Evaluation, so a failed Enrichment can be retried alone; no route retries it yet. A practice Writing Sample records no Practice Prompt (ADR 0026).
- 5f invariants: Progress stops counting practice-origin Writing Samples in the finding rate by default (ADR 0010); a Mistake Pattern loses the counts and example of a deleted Evaluation (`DATA-POLICY.md`, Deletion); the lint rule against Academy imports of Evaluation write services names the functions (`persistEvaluation`, `deleteEvaluation`, `evaluateWriting`), because Academy code reads through `getEvaluation`, which shares a module with `persistEvaluation`. The dashboard reads practice Evaluations directly from the `evaluations` table (`listPracticeWriting` in `apps/server/src/academy/academy-dashboard.ts`), which the rule must keep allowing.
- The server's persistence tests copy one migrated PGlite template per test (#112), kept in the system temporary directory under a hash of the migrations and the lockfile. A new migration builds a new template on the next run.
- CI runs the gate self-tests, about 2 more minutes, when a pull request changes a gate or a file in `SELF_TEST_FIXTURES` (`scripts/gate-selftest.ts`), `apps/server/src/edge.ts` among them, or a `package.json`, a `tsconfig` or the lockfile (`GATE_PATHS` in `scripts/ci-changes.ts`).
- G10 audits `port` rows only; a `port-changed` row's differences go in the pull request.
- CI flake seen once (PR #157): the end-to-end job hung on "Install the Playwright browser" for over nine minutes. Cancel the run and rerun its failed jobs (`gh run cancel <run>`, then `gh run rerun <run> --failed`).

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

- `mutation-tools/mutate.mjs <workspace> <mutations.json>`: applies each `{ file, from, to, tests }` alone, runs Vitest on `tests`, lists the tests that caught it, and restores the file. A `from` must match once in the file; a short anchor can also match inside a longer, more indented line.
- `mutation-tools/targets.mjs <repo> <slice> <report.json> <map.json>`: writes `targets` for rows whose verbatim titles passed in a Vitest JSON report. It refuses when any row of a mapped source has not passed.
- `mutation-tools/targets-subset.cjs <repo> <slice> <report.json> <source> <target file> <title>...`: the same for the named rows only, when a unit ports part of a source test.
- `tools/ledger-union.ts <repo> <ledger file>...`: during a merge conflict in `docs/migration/parity/`, keeps the union of both sides' rows and targets.

## Jhefferson's machine

- `$F` is `/home/jheff/projects/personal/fluenshift`. `$F/app-verify/protocol-review` is an old checkout outside the migration.
- Claude Code keeps its memory in `~/.claude/projects/-home-jheff-projects-personal-fluenshift-app/memory/`. A session hook makes chat replies terse; text written to the repository and to GitHub stays plain English.
- The interactive `grep` is ugrep, so one-liners call `/usr/bin/grep`.
