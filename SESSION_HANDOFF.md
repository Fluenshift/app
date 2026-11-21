# Session handoff

Last updated 2026-11-21, at the end of the fifteenth agent session, resumed. This file holds only what the repository and GitHub do not: the work in flight, the next steps and the facts they need. `AGENTS.md` holds the rules and how a unit runs. Rewrite this file at the end of every session, through a pull request.

## Work in flight

This session ran Phase 7, items 1 and 3 (#262: parity 603 verified, 268 terminal, 18 open, 0 blocked; the final audit found no gap), the `code-review` milestone before cutover on the diff since #256 (fixed in #264, #266 and #268), and the audit of item 6 of the definition of done (#270): five auditors read the merged documents against the code. #279 fixed every stale document. Where a document was right and the code wrong, the document stays and an issue holds the fix: #271 to #278. #280 fixed #272, a body over the cap that declares no length.

Merged work: `git log --first-parent --oneline main`. The rows that still wait for a target, one per line with their slice:

```sh
node -e 'const fs=require("fs");const d="docs/migration/parity/";for(const f of fs.readdirSync(d))for(const r of JSON.parse(fs.readFileSync(d+f)).rows)if(r.disposition.startsWith("port")&&r.targets.length===0)console.log(f,r.id)'
```

On 2026-11-21 the ledger held 889 rows, none `pending-decision`, and 18 still open, all paused: `hosted` 8 (the deploy-smoke rows of `docs/deploy.md`) and 10 end-to-end rows (the 4 dev-proxy cases of `evaluation-http`, the 6 rows of `evaluation-e2e`). Grifando's `/settings`, `/privacy` and `/explain-code` pages, Focus Music and the link preview have no rows: they port from source and their tests assert Grifando's copy, roles and calls (ADR 0025, decision 5).

## Next steps

1. The issues the audit of #270 opened, each labeled `ready-for-agent`, in this order:
   - #271: Writing Desk Evaluations never reach the Academy, against ADR 0004, ADR 0014 and ADR 0020. Decide in an ADR what "the Academy is in use" means and what the Writing Desk answers when the Enrichment fails; the issue gives the recommended options.
   - #273: `/setup` never names the local Trainer's key, and `docker-compose.yml` lost PE's `env_file`.
   - #274: the importer of ADR 0018, decision 2. Building it is session work; running it at cutover is the owners'.
   - #275 (fonts and the `hand-note` style), #276 (Mistake Notebook search), #277 (request validation with the contract's schemas), #278 (names against `CONTEXT.md`).
2. When they are closed, item 6 of the definition of done holds; run the `code-review` milestone again on the diff since the merge of #280.
3. Items 2, 4 and 6 of Phase 7, the import run of item 5, and sign-off wait for the owners (Owner steps). The 18 open rows stay open until the owners end the end-to-end pause; then port them, and run item 2 on a fresh clone of the release commit.

## Facts no issue records

### Seams

- The Academy (`apps/server/src/academy/**`, tests aside) reads the Evaluation tables only through `evaluationsView`, `findingsView` and `suggestionsView`; lint refuses the tables, `persistEvaluation`, `deleteEvaluation`, the `evaluation/` and `practice/` modules, and raw SQL (`execute`). Code that writes both axes composes them outside the Academy (`AGENTS.md`, Code).
- A Mistake Pattern's state is what `replayPattern` (`@fluenshift/core/pattern-replay`) builds from its Occurrences and the Attempts on its Exercises: deleting an Evaluation rebuilds each pattern it touched that way (`unfoldEvaluation`, called by Learning History's `deleteEvaluation`, ADR 0031). A new path that changes a pattern must be one the replay reproduces, and must stamp its Occurrence or Attempt with the moment it writes on the pattern (`now` in `pattern-folding.ts`, `submitAttempt`), or the next deletion undoes it.
- Progress reads `listEvaluations({ origin: "work" })`: practice writing stays out of every insight and its evidence (ADR 0030). The Academy dashboard's trend reads practice (ADR 0027).
- A fix-commit or issue row takes as targets the tests that pin its fix, which may already be targets of the rows that ported them (`docs/migration/README.md`, `targets`).

### Hosted profile

- `createApp` takes `profile: "hosted"` only with its `session` (`SessionSettings` of `@fluenshift/env`) and its `siteUrl`. In that profile `securityHeaders` sets the CSP and Grifando's four headers on every answer, `guard` refuses a body over 256 KiB, then `sessionGate` refuses an API request without a valid `ig_session` cookie (401 `SESSION_REQUIRED`), except `GET /api/health`, and mints a cookie on any other answer but `/assets/` (ADR 0032). `index.ts` builds the server per profile with `Layer.unwrap`; the hosted branch provides `LearnerIdentity.hosted` and `SessionConfig.layer`.
- A hosted test signs its cookie with the secret it gives `SessionConfig`: `hosted-pipeline.test.ts` and `me-route.test.ts` show the setup. Every hosted API request in a test carries that cookie, the health check aside.
- `sessionCookie(value, maxAgeSeconds, secure)` writes a cookie as Grifando's Next.js did, attribute order included, because characterizations pin the exact strings.
- The guard refuses a declared body over the cap before reading it, then counts a body that declares no length with Hono's `bodyLimit`, which hands the routes a buffered copy of the request (#272). An in-process test request with a string body declares no length, so every route test reads that copy.
- Every state-changing route admits its call in `app.ts` (`admitted`, `admittedWithTrainerKey`, `admittedWithTrainerAndJudgeKeys`): after its body check, after a Trainer route finds a key in the headers and, in the hosted profile, after a route that runs the Judge finds an OpenRouter key, the `limitRequest` boundary, then `ensureLearner`, then its work (ADR 0033, ADR 0035). `index.ts` passes both boundaries in the hosted profile only, so route tests that omit them run unlimited. A new state-changing route must be admitted with a bucket, and its `errors` need `RateLimitedError: rateLimited`.
- A fake boundary in a route test must record when its Effect runs, inside `Effect.sync`, not when it is called: `app.ts` builds a boundary's Effect before the limit decides whether it runs (`rate-limit-routes.test.ts`).
- A hosted production server needs `SESSION_SECRET`, `IP_HASH_SALT`, `CLIENT_IP_HEADER` and `SITE_URL` (`AGENTS.md`, Code). The hosted profile forks the idle cleanup at 03:17 UTC daily (`IdleCleanup`).
- The hosted Docker smoke is paused, so #215 and #220 checked the hosted wiring by hand: start `postgres:17-alpine` on a loopback port, run `pnpm build`, then in `apps/server` run `node dist/index.mjs` with `DEPLOY_PROFILE=hosted`, `NODE_ENV=production`, `DATABASE_URL`, `MIGRATIONS_PATH=../../packages/db/src/migrations`, `WEB_DIST_PATH=../web/dist`, `SESSION_SECRET`, `IP_HASH_SALT` and a free `SERVER_PORT`, and drive it with `curl`. Stop it with `pgrep -f 'node dis[t]/index.mjs' | xargs -r kill`.
- The Writing Desk's "Provider setup required" gate reads `GET /api/setup`'s `configured` in the local profile only (#249): the hosted server never holds a Judge key, so there `configured` is always false and gates nothing.
- The SPA reads `GET /api/deploy-profile` once in `main.tsx` (`readDeployProfile`), before it builds its clients; a failed answer reads as `local` (ADR 0034). The router context carries `deployProfile`, and `createAppRouter` defaults to `local`, so a screen test of the hosted profile passes `deployProfile: "hosted"`. `KeyRequiredNotice` and `AcademyNav` read it from the root route's context.
- In the hosted profile the HTTP Academy client sends its Trainer calls and the key test through a second Hono client whose fetch is `aiFetch` (`trainer` in `createHttpAcademyClient`), so no other call carries the key; the HTTP Evaluation client sends `POST /api/evaluations` the same way. `/settings` redirects to `/setup` in the local profile.
- A hosted route that runs the Judge goes through `withJudgeKey` in `app.ts` (`admittedWithTrainerAndJudgeKeys` when it also runs the Trainer): it provides the request's OpenRouter key as `JudgeKey` (`apps/server/src/evaluation/evaluation-model.ts`), which the Judge's model is built on for that call, or answers 401 `AI_JUDGE_KEY_REQUIRED` before its rate limit, with no key at all as with another provider's (ADR 0035, #251). A key it cannot read fails with the route's own error: 400 `AI_KEY_INVALID` on the routes that also run the Trainer, as Grifando answered (#263), and `AI_JUDGE_KEY_REQUIRED` on `POST /api/evaluations` (#232). A hosted route test that reaches the Judge sends an OpenRouter key.
- A web test that needs storage the browser blocks spies on `Storage.prototype.setItem` (`-settings.test.tsx`).
- `apps/web/src/routeTree.gen.ts` is ignored by git and written by the router plugin when Vite builds. After adding a route, run `pnpm exec vite build` in `apps/web` before its tests or `tsc`: until then the route does not exist and its screen tests time out.
- Each profile links only its own pages (ADR 0036): the hosted profile redirects `/setup` to `/privacy` and its primary navigation ends with "Key settings" and "Privacy"; the local profile redirects `/privacy` and `/settings` to `/setup` and keeps "Setup & privacy". The privacy page restates what ADR 0013, ADR 0033 and ADR 0035 decide (analytics, the hashed IP, which provider each key reaches): a change to one changes the page and `-privacy.test.tsx` together.
- "Delete my data" calls `deleteLearner` on the Academy client (`DELETE /api/me`, no key), then removes the stored key and reloads `/` with `window.location.assign`, because only a page load mints a new session. jsdom refuses a spy on `location.assign`: a test replaces the global with `vi.stubGlobal("location", { assign })` and `vi.unstubAllGlobals()` after.
- The hosted profile answers `/robots.txt` and `/sitemap.xml` at the origin `SiteConfig` reads from `SITE_URL` (ADR 0037), and the session gate mints no cookie on them; the local profile serves neither. A new public page joins the sitemap through `PUBLIC_PATHS` in `apps/server/src/site-files.ts`. Every hosted test app passes a `siteUrl`.
- The key store (`apps/web/src/features/settings/ai-key-store.ts`) and the Trainer key's headers, providers and key test answer (`packages/contract/src/trainer-key.ts`) are shared by the browser and the server. In `apps/web/src/api.ts`, `apiOf` builds the plain client and `keyedApiOf` the hosted one whose fetch is `aiFetch`.
- The shell's metadata is static in `apps/web/index.html`, in both profiles; the hosted server adds the card's Open Graph tags, then the `twitter:image` tags Next.js filled from them because Grifando's Twitter card declared no image (#265), before `</head>` (`withLinkPreview` in `apps/server/src/site-files.ts`) and serves `/og-image.png` from the build's root without a session cookie (`SITE_FILE_PATHS`). The card is `apps/web/public/og-image.png`, rendered once from Grifando's `opengraph-image.tsx` with satori and resvg (ADR 0040); a new brand renders it again at 1200 by 630.

### Academy, server

- Explain code is practice writing with a `codeSnippet` (ADR 0038): the route checks it against the Deploy Profile's code cap (2,000 characters hosted, none locally), `evaluatePractice` checks it again before the Judge runs, and only `foldEvaluation` receives it, for the Trainer. `SampleLimits` carries `codeMaxCharacters` for the code sheet. A service test that needs the hosted cap provides a changed `ServerConfig` around the call (`withHostedCodeCap` in `practice-writing-routes.test.ts`).
- Practice writing composes outside the Academy, in `apps/server/src/practice/practice-writing.ts`: `evaluatePractice` runs the Judge with the practice origin, then `foldEvaluation`; ADR 0024 and ADR 0026 set the failure answers. `foldEvaluation` runs in one transaction and refuses a second fold of the same Evaluation, so a failed Enrichment can be retried alone; no route retries it yet. A practice Writing Sample records no Practice Prompt (ADR 0026).
- The Enrichment runs on every practice Evaluation, even one whose Findings form no Mistake Pattern (ADR 0028). It answers the Findings' entries, the natural version, which the `enrichments` row keeps (`getNaturalVersion` in `enrichment-repository.ts`), and the notes, each an `UNNATURAL` Occurrence of an `UNNATURAL_PHRASING` pattern with a `note_position` and no Finding. The practice writing and interview answers carry `naturalVersion`.
- A route that calls the Trainer takes it from `trainerForRequest(headers)` (`apps/server/src/academy/academy-requests.ts`): the request headers, else the local profile's configured key, else `TrainerKeyRequiredError`. Each such route has a helper that resolves the key before it reads anything (`generateExercisesFor`, `explainAttemptFor`, `startInterviewFor`, `answerInterviewTurnFor`, `practiceWritingFor`). Its edge answers access errors through `TRAINER_FAILURES` and takes an `unexpected` failure when it keeps its source's 500 message (`SOMETHING_WENT_WRONG`, `EXPLANATION_FAILED`). `NOT_FOUND` is Grifando's 404 body.
- `makeEdge` takes a `log` context: every generic 500 a route answers logs one error-level line with the context and the error's tag or name, never its message (ADR 0026). A new Academy route names one; `practice-writing-routes.test.ts` shows how a test keeps the runtime's log lines.
- An OpenRouter key runs the Trainer on fixed pins (`google/gemini-3.5-flash`, fallback `google/gemini-3.5-flash-lite`, in `packages/env/src/trainer.ts`). `trainerFailure` reads OpenRouter's 402 and its errors inside a 200 answer, and `isGemini` gives its `google/` models Gemini's schema (`ai-sdk-trainer.ts`).
- A route's error entries need a case when no source test covers them, or a remapped answer passes every gate. `POST /api/exercises` still maps a refused Trainer answer to the generic 500 with no case.
- Academy route tests follow `exercise-routes.test.ts` or `interview-routes.test.ts`: a real PGlite database, the `x-test-learner` header picks the Learner, a fake `TrainerClient` layer, and `TrainerConfig` read from an empty environment. Page read route tests live in `page-routes.test.ts`, with seed helpers and the clock fixed by `vi.useFakeTimers({ now, toFake: ["Date"] })`; each route's `DatabaseError` entry has its own "answers the generic 500" case.
- The server's persistence tests copy one migrated PGlite template per test (#112), keyed by a hash of the migrations and the lockfile; a new migration builds a new template on the next run.

### Academy, web

- Each page read is a Hono `GET` route plus an SPA route (ADR 0025). `PageShell` carries the Academy's navigation; a new screen's entry goes in `NAV_LINKS`. Screens call the server through the `AcademyClient` (`academy-client.ts`): over HTTP in `apps/web/src/api.ts`, and in screen tests through `createInMemoryAcademyClient`, which answers from fixtures and records requests. `createAppRouter` defaults to `unavailableAcademyClient`. A component reads the client with `useRouteContext({ from: "__root__" })`; `failureNotice(error, fallback)` gives a failed request's key notice or message.
- A screen with a writing sheet reads the Deploy Profile's caps from `GET /api/sample-limits` in its `beforeLoad` (`sampleLimitsFor`), so its loader data stays its own; the in-memory client defaults to the local caps (32 KiB, no character cap).
- Academy screens show a practice Evaluation through `PracticeEvaluation` (with one `OccurrenceNote` or `FindingNote` per note) and an interview turn through `TurnFeedback`.
- Grifando's client components port from source (ADR 0025, decision 5): no baseline test renders them, so screen tests assert Grifando's copy, roles and calls. Copy stays Grifando's; names follow `CONTEXT.md`, in ported tests too (`docs/migration/README.md`, Mechanical mapping).
- Find queries wait 5 seconds (`apps/web/src/test/setup.ts`): a screen's first render loads its route chunk and runs its loader.
- Focus Music (`apps/web/src/features/music/focus-music.tsx`) sits in the header of both profiles, beside the primary navigation, in the root route, so it stays mounted across pages (ADR 0039). It reads browser storage only when first opened (`focus-music:last-link`, `focus-music:playlists`). Its frame's sandbox pairs `allow-scripts` with `allow-same-origin`, which both players need; lint admits that pair in this one file, G11 records the override, and `-focus-music.test.tsx` pins the sandbox. Any other iframe needs a sandbox the rule accepts. A new music provider needs its origin in the hosted CSP's `frame-src`, a parser in `music-link.ts`, and a check in a real browser that it plays in that sandbox.
- A web test that reads a file of the workspace builds its path from `import.meta.dirname`: under jsdom, `new URL(..., import.meta.url)` is jsdom's URL, which `node:fs` refuses (`link-preview.test.ts`).
- No key travels from the browser in the local profile: the server uses its configured Trainer key or answers 401 `AI_KEY_REQUIRED`, which shows Grifando's key notice.
- Lint shapes React code: a label around a base-ui radio needs `htmlFor` and the radio an `id` when its text is a literal (`label-has-associated-control`); the React Compiler rule refuses `try`/`finally` in a component; the promise rules refuse `.then(onOk, onError)` and callbacks inside `.then`, so a component awaits a module-level async helper that catches; `<output>` replaces `role="status"` and `<fieldset>` replaces `role="group"`; wrap a handler passed as `onClick={props.onX}` in an arrow; no nested ternaries; regular expressions take the `u` flag; no member access on an `await` expression. TanStack route options go in the order `validateSearch`, `loaderDeps`, `beforeLoad`, `loader`, `component`.
- Hono's typed client takes no `json` for a route with path parameters that reads its body itself: send the body through `init` (`submitAttempt` in `api.ts`). A typed `Link` needs an existing route.
- Grifando's category breakdown orders by count only: a tie keeps no order, and tests do not assert one.

### Gates and CI

- G10 checks class A and B rows strictly: a port keeps the source's matcher (`toBeNull` stays `toBeNull`, not a count). Run `node scripts/migration/parity-audit.ts --root ../app-baselines` before pushing a class B port.
- A characterization run (`node scripts/migration/characterization-run.ts grifando`) takes about 3 minutes and needs Docker. A mutation spot-check that survives in pure code usually means a gap the baseline tests leave: characterize it, then fold the new tests into the unit's first commit (reset to it, amend, cherry-pick the later commits), so G8 still sees them red.
- `node scripts/migration/mutate.ts` matches `from` against the formatted file: oxfmt splits long conditions over lines.
- Hono middleware: lint refuses `await next()` (`node/callback-return`) and an inline `.then` callback that returns nothing (`promise/always-return`); pass a named arrow to `next().then`, as `guard` does.
- Run `pnpm lint:effect` before pushing a test that decodes: it warns on `Schema.decodeUnknown*` over a value already typed as the schema's encoded side (use `Schema.decodeExit`), and warnings fail CI.
- G7 accepts only the path parameters ADR 0023 lists (`PATH_PARAMETERS` in `scripts/check-url-text.ts`); a new one needs an ADR. Filters and prompt choices stay in the SPA's own URL (ADR 0025).
- G10 audits `port` rows only; a `port-changed` row's differences go in the pull request. A run reports 15 standing class C differences: 14 on the Trainer, resilience, key test and OpenRouter rows (listed in #199), and the route pattern `/:path*` of the `next.config` characterization (#215); say so in the pull request body.
- CI runs the gate self-tests, about 2 more minutes, when a pull request changes a gate, a file in `SELF_TEST_FIXTURES` (`scripts/gate-selftest.ts`, `apps/server/src/edge.ts` among them), a `package.json`, a `tsconfig` or the lockfile (`GATE_PATHS` in `scripts/ci-changes.ts`).
- CI flake seen once (PR #157): the end-to-end job hung on "Install the Playwright browser" for over nine minutes. Cancel the run and rerun its failed jobs (`gh run cancel <run>`, then `gh run rerun <run> --failed`).
- CI, measured on 2026-11-16: a pull request that changes product code takes about 2.3 minutes, one that changes a gate about 2.8, and one that changes only Markdown outside the workspaces runs the static checks and G7 alone. Measure before changing CI again.

## Owner steps

Sessions never do these (`AGENTS.md`, Rules): they cannot be undone outside this repository, or they cost money.

- Archive `Fluenshift/prompt-evolution`; its pin was verified on 2026-11-12.
- Levy: point local Grifando clones at `https://github.com/Fluenshift/grifando.git`; reconnect Grifando's Vercel project to the organization and give its CI a `GITLEAKS_LICENSE` secret, if Grifando still deploys from there.
- Set a budget before live calibration (G13) runs.
- Choose the host for the hosted profile (ADR 0003, decision 4) before a public deploy, and give it `SESSION_SECRET`, `IP_HASH_SALT`, the `CLIENT_IP_HEADER` its proxy writes (ADR 0033) and its public origin as `SITE_URL` (ADR 0037).
- Give the go-ahead for cutover (Phase 7).
- At cutover, run the importer of PE's local Evaluations once #274 builds it: a dry run first, accepted only when its counts match (ADR 0018).
- Say where Grifando's visual style came from, for `docs/product/ASSET-LICENSES.md` (#119, question 4).

## Jhefferson's machine

- `$F` is `/home/jheff/projects/personal/fluenshift`. `$F/app-verify/protocol-review` is an old checkout outside the migration.
- Claude Code keeps its memory in `~/.claude/projects/-home-jheff-projects-personal-fluenshift-app/memory/`. A session hook makes chat replies terse; text written to the repository and to GitHub stays plain English.
- The interactive `grep` is ugrep, so one-liners call `/usr/bin/grep`.
- `git rebase` signs by default and gpg times out: run `git -c commit.gpgsign=false rebase origin/main`, and abort a rebase that already stopped on a signature before rerunning it.
- `$F/app-baselines/worktrees/grifando-run/node_modules` holds Grifando's packages as its baseline run installed them, Next.js 16.4.5 included: read a framework's behavior there when a port depends on it, as #265 read how Next.js wrote metadata.
- Google Chrome is installed (`/usr/bin/google-chrome`): Playwright's `channel: "chrome"` can check a third-party player outside the repository, as #252 did for the sandbox.
- A Postgres container from an earlier hand check, `fs-unit-pg`, listens on `127.0.0.1:55432` (user `app`, password `pw`, database `app`). Reuse it for hosted hand checks, or remove it with `docker rm -f fs-unit-pg`.
