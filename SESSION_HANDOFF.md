# Session handoff

Last updated 2026-11-20, at the end of the ninth agent session. This file holds only what the repository and GitHub do not: the work in flight, the next steps and the facts they need. `AGENTS.md` holds the rules and how a unit runs. Rewrite this file at the end of every session, through a pull request.

## Work in flight

Nothing besides this handoff, and no issue is open. This session built the natural version and the Naturalness Notes of the Enrichment (#198, PR #199, ADR 0028), sized the Academy's writing sheets by the Deploy Profile's caps (#196, PR #200), and renamed the Academy's code in the `CONTEXT.md` vocabulary (#195, PR #201). Phase 5e and its review findings are done.

Merged work: `git log --first-parent --oneline main`. The rows that still wait for a target, one per line with their slice:

```sh
node -e 'const fs=require("fs");const d="docs/migration/parity/";for(const f of fs.readdirSync(d))for(const r of JSON.parse(fs.readFileSync(d+f)).rows)if(r.disposition.startsWith("port")&&r.targets.length===0)console.log(f,r.id)'
```

On 2026-11-20 there were 71: `academy-spec` 9, `hosted` 52, and 10 paused end-to-end rows (the 4 dev-proxy cases of `evaluation-http`, the 6 rows of `evaluation-e2e`), which stay open.

## Next steps

1. **Phase 5f** (`docs/migration/MIGRATION_PROTOCOL.md`, Phases): the seam invariants under "Phase 5f" below, then the 9 `academy-spec` rows: Grifando fix commits `2a86084`, `8b80767` and `0083c7f` (`port`), `9ba8040` (ADR 0003), `9f5e47e` and `397b0b4` (ADR 0009), `80957b6` (ADR 0012), and Grifando issues 77 (ADR 0012) and 78 (ADR 0004). Run `code-review` at the end of the phase.
2. **Phase 6** (`hosted`, 52 rows, which matter once the owners want a public deploy, and Grifando's remaining pages: `/explain-code`, `/settings` with BYOK, `/privacy`), then **Phase 7**. Run `code-review` at the end of each phase.

## Facts no issue records

### Phase 5f

- Progress stops counting practice-origin Writing Samples in the finding rate by default (ADR 0010).
- A Mistake Pattern loses the counts and example of a deleted Evaluation (`DATA-POLICY.md`, Deletion). A pattern now grows from Naturalness Notes too: a note adds an Occurrence and moves the last seen time and the example, never the incorrect count or the last recall (ADR 0028), so undoing a deleted Evaluation's notes must not touch the recall counters either.
- The lint rule against Academy imports of Evaluation write services names the functions (`persistEvaluation`, `deleteEvaluation`, `evaluateWriting`), because Academy code reads through `getEvaluation`, which shares a module with `persistEvaluation`. The dashboard reads `evaluations` and `findings` directly (`listPracticeWriting` and the trend in `apps/server/src/academy/academy-dashboard.ts`), which the rule must keep allowing; #195 left those queries there for this unit to place.

### Academy, server

- Practice writing composes outside the Academy, in `apps/server/src/practice/practice-writing.ts`: `evaluatePractice` runs the Judge with the practice origin, then `foldEvaluation`; ADR 0024 and ADR 0026 set the failure answers. `foldEvaluation` runs in one transaction and refuses a second fold of the same Evaluation, so a failed Enrichment can be retried alone; no route retries it yet. A practice Writing Sample records no Practice Prompt (ADR 0026).
- The Enrichment runs on every practice Evaluation, even one whose Findings form no Mistake Pattern (ADR 0028). It answers the Findings' entries, the natural version, which the `enrichments` row keeps (`getNaturalVersion` in `enrichment-repository.ts`), and the notes, each an `UNNATURAL` Occurrence of an `UNNATURAL_PHRASING` pattern with a `note_position` and no Finding. The practice writing and interview answers carry `naturalVersion`.
- A route that calls the Trainer takes it from `trainerForRequest(headers)` (`apps/server/src/academy/academy-requests.ts`): the request headers, else the local profile's configured key, else `TrainerKeyRequiredError`. Each such route has a helper that resolves the key before it reads anything (`generateExercisesFor`, `explainAttemptFor`, `startInterviewFor`, `answerInterviewTurnFor`, `practiceWritingFor`). Its edge answers access errors through `TRAINER_FAILURES` and takes an `unexpected` failure when it keeps its source's 500 message (`SOMETHING_WENT_WRONG`, `EXPLANATION_FAILED`). `NOT_FOUND` is Grifando's 404 body.
- `makeEdge` takes a `log` context: every generic 500 a route answers logs one error-level line with the context and the error's tag or name, never its message (ADR 0026). A new Academy route names one; `practice-writing-routes.test.ts` shows how a test keeps the runtime's log lines.
- A route's error entries need a case when no source test covers them, or a remapped answer passes every gate. `POST /api/exercises` still maps a refused Trainer answer to the generic 500 with no case.
- Academy route tests follow `exercise-routes.test.ts` or `interview-routes.test.ts`: a real PGlite database, the `x-test-learner` header picks the Learner, a fake `TrainerClient` layer, and `TrainerConfig` read from an empty environment. Page read route tests live in `page-routes.test.ts`, with seed helpers and the clock fixed by `vi.useFakeTimers({ now, toFake: ["Date"] })`; each route's `DatabaseError` entry has its own "answers the generic 500" case.
- The server's persistence tests copy one migrated PGlite template per test (#112), keyed by a hash of the migrations and the lockfile; a new migration builds a new template on the next run.
- The rate limiter rows wait for the hosted request pipeline (Phase 6), with Grifando's `ensureUser` (`hosted`, `rateLimitFirst`).

### Academy, web

- Each page read is a Hono `GET` route plus an SPA route (ADR 0025). `PageShell` carries the Academy's navigation; a new screen's entry goes in `NAV_LINKS`. Screens call the server through the `AcademyClient` (`academy-client.ts`): over HTTP in `apps/web/src/api.ts`, and in screen tests through `createInMemoryAcademyClient`, which answers from fixtures and records requests. `createAppRouter` defaults to `unavailableAcademyClient`. A component reads the client with `useRouteContext({ from: "__root__" })`; `failureNotice(error, fallback)` gives a failed request's key notice or message.
- A screen with a writing sheet reads the Deploy Profile's caps from `GET /api/sample-limits` in its `beforeLoad` (`sampleLimitsFor`), so its loader data stays its own; the in-memory client defaults to the local caps (32 KiB, no character cap).
- Academy screens show a practice Evaluation through `PracticeEvaluation` (with one `OccurrenceNote` or `FindingNote` per note) and an interview turn through `TurnFeedback`.
- Grifando's client components port from source (ADR 0025, decision 5): no baseline test renders them, so screen tests assert Grifando's copy, roles and calls. Copy stays Grifando's; names follow `CONTEXT.md`, in ported tests too (`docs/migration/README.md`, Mechanical mapping).
- Find queries wait 5 seconds (`apps/web/src/test/setup.ts`): a screen's first render loads its route chunk and runs its loader.
- No key travels from the browser in the local profile: the server uses its configured Trainer key or answers 401 `AI_KEY_REQUIRED`, which shows Grifando's key notice. The browser key store arrives with BYOK in Phase 6.
- Lint shapes React code: the React Compiler rule refuses `try`/`finally` in a component; the promise rules refuse `.then(onOk, onError)` and callbacks inside `.then`, so a component awaits a module-level async helper that catches; `<output>` replaces `role="status"` and `<fieldset>` replaces `role="group"`; wrap a handler passed as `onClick={props.onX}` in an arrow; no nested ternaries; regular expressions take the `u` flag; no member access on an `await` expression. TanStack route options go in the order `validateSearch`, `loaderDeps`, `beforeLoad`, `loader`, `component`.
- Hono's typed client takes no `json` for a route with path parameters that reads its body itself: send the body through `init` (`submitAttempt` in `api.ts`). A typed `Link` needs an existing route.
- Grifando's category breakdown orders by count only: a tie keeps no order, and tests do not assert one.

### Gates and CI

- Run `pnpm lint:effect` before pushing a test that decodes: it warns on `Schema.decodeUnknown*` over a value already typed as the schema's encoded side (use `Schema.decodeExit`), and warnings fail CI.
- G7 accepts only the path parameters ADR 0023 lists (`PATH_PARAMETERS` in `scripts/check-url-text.ts`); a new one needs an ADR. Filters and prompt choices stay in the SPA's own URL (ADR 0025).
- G10 audits `port` rows only; a `port-changed` row's differences go in the pull request. A run reports 14 standing class C differences on the Trainer, resilience, key test and OpenRouter rows (listed in #199); say so in the pull request body.
- CI runs the gate self-tests, about 2 more minutes, when a pull request changes a gate, a file in `SELF_TEST_FIXTURES` (`scripts/gate-selftest.ts`, `apps/server/src/edge.ts` among them), a `package.json`, a `tsconfig` or the lockfile (`GATE_PATHS` in `scripts/ci-changes.ts`).
- CI flake seen once (PR #157): the end-to-end job hung on "Install the Playwright browser" for over nine minutes. Cancel the run and rerun its failed jobs (`gh run cancel <run>`, then `gh run rerun <run> --failed`).
- CI, measured on 2026-11-16: a pull request that changes product code takes about 2.3 minutes, one that changes a gate about 2.8, and one that changes only Markdown outside the workspaces runs the static checks and G7 alone. Measure before changing CI again.

## Owner steps

Sessions never do these (`AGENTS.md`, Rules): they cannot be undone outside this repository, or they cost money.

- Archive `Fluenshift/prompt-evolution`; its pin was verified on 2026-11-12.
- Levy: point local Grifando clones at `https://github.com/Fluenshift/grifando.git`; reconnect Grifando's Vercel project to the organization and give its CI a `GITLEAKS_LICENSE` secret, if Grifando still deploys from there.
- Set a budget before live calibration (G13) runs.
- Give the go-ahead for cutover (Phase 7).
- Say where Grifando's visual style came from, for `docs/product/ASSET-LICENSES.md` (#119, question 4).

## Jhefferson's machine

- `$F` is `/home/jheff/projects/personal/fluenshift`. `$F/app-verify/protocol-review` is an old checkout outside the migration.
- Claude Code keeps its memory in `~/.claude/projects/-home-jheff-projects-personal-fluenshift-app/memory/`. A session hook makes chat replies terse; text written to the repository and to GitHub stays plain English.
- The interactive `grep` is ugrep, so one-liners call `/usr/bin/grep`.
