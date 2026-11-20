# Session handoff

Last updated 2026-11-20, at the end of the tenth agent session. This file holds only what the repository and GitHub do not: the work in flight, the next steps and the facts they need. `AGENTS.md` holds the rules and how a unit runs. Rewrite this file at the end of every session, through a pull request.

## Work in flight

Nothing besides this handoff, and no issue is open. Phase 5 is done. This session finished Phase 5f: it closed the `academy-spec` rows earlier units built and pinned Grifando #77 and #78 with regression tests (#203, ADR 0029), added the seam gate that keeps the Academy from writing Evaluations (#204), kept practice writing out of Progress (#205, ADR 0030), made deleting an Evaluation rebuild the Mistake Patterns it touched (#206, ADR 0031), and fixed what the phase's `code-review` found (#211).

Merged work: `git log --first-parent --oneline main`. The rows that still wait for a target, one per line with their slice:

```sh
node -e 'const fs=require("fs");const d="docs/migration/parity/";for(const f of fs.readdirSync(d))for(const r of JSON.parse(fs.readFileSync(d+f)).rows)if(r.disposition.startsWith("port")&&r.targets.length===0)console.log(f,r.id)'
```

On 2026-11-20 there were 64: `hosted` 52, `academy-spec` 2, and 10 paused end-to-end rows (the 4 dev-proxy cases of `evaluation-http`, the 6 rows of `evaluation-e2e`), which stay open.

## Next steps

1. **Phase 6** (`docs/migration/MIGRATION_PROTOCOL.md`, Phases), which matters once the owners want a public deploy; run `code-review` at its end. The open rows group into these units, each an issue with its rows (`hosted.json` unless named):
   - The hosted request pipeline, one serial unit: `src/server/session/sessionToken.test.ts`, `currentUser.test.ts`, `getCurrentUserId.test.ts` and `src/proxy.test.ts` (`port-changed`, ADR 0003: the API sets the cookie, and the CSP is a static SPA's).
   - Rate limits: `src/server/rateLimit.test.ts`, `src/server/clientIp.test.ts`, `src/app/api/rateLimitFirst.characterization.test.ts`, and `academy-spec`'s `grifando:fix-commit:9ba8040` (rate-limit before creating a Learner, fail fast on missing production secrets).
   - `DELETE /api/me`: `src/app/api/me/route.test.ts` and `me.characterization.test.ts`.
   - Idle cleanup on the scheduler of ADR 0011: `src/server/domain/privacy/cleanup.test.ts`.
   - BYOK: `src/lib/aiKeyStore.test.ts`, `src/app/api/ai-key/test/route.test.ts`, `academy-spec`'s `grifando:fix-commit:2a86084` (same-origin `aiFetch`, blocked key storage reported), and the `/settings` page.
   - Robots and sitemap: `src/app/sitemap.test.ts`.
   - Grifando's remaining pages: `/explain-code` and `/privacy`.
   - `docs/deploy.md` (8 rows) is the hosted Docker smoke, paused with the end-to-end tests.
2. **Phase 7**, then its `code-review`.

## Facts no issue records

### Seams

- The Academy (`apps/server/src/academy/**`, tests aside) reads the Evaluation tables only through `evaluationsView`, `findingsView` and `suggestionsView`; lint refuses the tables, `persistEvaluation`, `deleteEvaluation`, the `evaluation/` and `practice/` modules, and raw SQL (`execute`). Code that writes both axes composes them outside the Academy (`AGENTS.md`, Code).
- A Mistake Pattern's state is what `replayPattern` (`@fluenshift/core/pattern-replay`) builds from its Occurrences and the Attempts on its Exercises: deleting an Evaluation rebuilds each pattern it touched that way (`unfoldEvaluation`, called by Learning History's `deleteEvaluation`, ADR 0031). A new path that changes a pattern must be one the replay reproduces, and must stamp its Occurrence or Attempt with the moment it writes on the pattern (`now` in `pattern-folding.ts`, `submitAttempt`), or the next deletion undoes it.
- Progress reads `listEvaluations({ origin: "work" })`: practice writing stays out of every insight and its evidence (ADR 0030). The Academy dashboard's trend reads practice (ADR 0027).
- A fix-commit or issue row takes as targets the tests that pin its fix, which may already be targets of the rows that ported them (`docs/migration/README.md`, `targets`).

### Academy, server

- Practice writing composes outside the Academy, in `apps/server/src/practice/practice-writing.ts`: `evaluatePractice` runs the Judge with the practice origin, then `foldEvaluation`; ADR 0024 and ADR 0026 set the failure answers. `foldEvaluation` runs in one transaction and refuses a second fold of the same Evaluation, so a failed Enrichment can be retried alone; no route retries it yet. A practice Writing Sample records no Practice Prompt (ADR 0026).
- The Enrichment runs on every practice Evaluation, even one whose Findings form no Mistake Pattern (ADR 0028). It answers the Findings' entries, the natural version, which the `enrichments` row keeps (`getNaturalVersion` in `enrichment-repository.ts`), and the notes, each an `UNNATURAL` Occurrence of an `UNNATURAL_PHRASING` pattern with a `note_position` and no Finding. The practice writing and interview answers carry `naturalVersion`.
- A route that calls the Trainer takes it from `trainerForRequest(headers)` (`apps/server/src/academy/academy-requests.ts`): the request headers, else the local profile's configured key, else `TrainerKeyRequiredError`. Each such route has a helper that resolves the key before it reads anything (`generateExercisesFor`, `explainAttemptFor`, `startInterviewFor`, `answerInterviewTurnFor`, `practiceWritingFor`). Its edge answers access errors through `TRAINER_FAILURES` and takes an `unexpected` failure when it keeps its source's 500 message (`SOMETHING_WENT_WRONG`, `EXPLANATION_FAILED`). `NOT_FOUND` is Grifando's 404 body.
- `makeEdge` takes a `log` context: every generic 500 a route answers logs one error-level line with the context and the error's tag or name, never its message (ADR 0026). A new Academy route names one; `practice-writing-routes.test.ts` shows how a test keeps the runtime's log lines.
- A route's error entries need a case when no source test covers them, or a remapped answer passes every gate. `POST /api/exercises` still maps a refused Trainer answer to the generic 500 with no case.
- Academy route tests follow `exercise-routes.test.ts` or `interview-routes.test.ts`: a real PGlite database, the `x-test-learner` header picks the Learner, a fake `TrainerClient` layer, and `TrainerConfig` read from an empty environment. Page read route tests live in `page-routes.test.ts`, with seed helpers and the clock fixed by `vi.useFakeTimers({ now, toFake: ["Date"] })`; each route's `DatabaseError` entry has its own "answers the generic 500" case.
- The server's persistence tests copy one migrated PGlite template per test (#112), keyed by a hash of the migrations and the lockfile; a new migration builds a new template on the next run.

### Academy, web

- Each page read is a Hono `GET` route plus an SPA route (ADR 0025). `PageShell` carries the Academy's navigation; a new screen's entry goes in `NAV_LINKS`. Screens call the server through the `AcademyClient` (`academy-client.ts`): over HTTP in `apps/web/src/api.ts`, and in screen tests through `createInMemoryAcademyClient`, which answers from fixtures and records requests. `createAppRouter` defaults to `unavailableAcademyClient`. A component reads the client with `useRouteContext({ from: "__root__" })`; `failureNotice(error, fallback)` gives a failed request's key notice or message.
- A screen with a writing sheet reads the Deploy Profile's caps from `GET /api/sample-limits` in its `beforeLoad` (`sampleLimitsFor`), so its loader data stays its own; the in-memory client defaults to the local caps (32 KiB, no character cap).
- Academy screens show a practice Evaluation through `PracticeEvaluation` (with one `OccurrenceNote` or `FindingNote` per note) and an interview turn through `TurnFeedback`.
- Grifando's client components port from source (ADR 0025, decision 5): no baseline test renders them, so screen tests assert Grifando's copy, roles and calls. Copy stays Grifando's; names follow `CONTEXT.md`, in ported tests too (`docs/migration/README.md`, Mechanical mapping).
- Find queries wait 5 seconds (`apps/web/src/test/setup.ts`): a screen's first render loads its route chunk and runs its loader.
- No key travels from the browser in the local profile: the server uses its configured Trainer key or answers 401 `AI_KEY_REQUIRED`, which shows Grifando's key notice.
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
