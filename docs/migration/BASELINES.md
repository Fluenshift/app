# Baselines

The frozen references for the migration: how to get each source at its pinned commit, the
toolchain it runs on, and how its suites were run. The pins live in
[`baselines.json`](./baselines.json) and are the authority; the `parity-baseline` tag in each
source repository only keeps the commit reachable.

| System | Repository | Tag | Pinned commit |
| --- | --- | --- | --- |
| `pe` | [`Fluenshift/prompt-evolution`](https://github.com/Fluenshift/prompt-evolution) | `parity-baseline` | `5e831bb6f2af1ae0f52c2ff1af1c28c605a25486` |
| `grifando` | [`Fluenshift/grifando`](https://github.com/Fluenshift/grifando) | `parity-baseline` | `74dbb9f3305faa4444f981aa2df360c028d3ab08` |

## Getting a baseline

The scripts in `scripts/migration/` run on plain Node 26.13.0 (type stripping) with no
dependencies. Node 26.13.0 is installed with mise but not activated globally, hence the
`mise exec` prefix.

```bash
mise exec node@26.13.0 -- node scripts/migration/baselines.ts verify                     # remote tags still resolve to the pins
mise exec node@26.13.0 -- node scripts/migration/baselines.ts sync                       # clone or update ../app-baselines/<system> at the pin
mise exec node@26.13.0 -- node scripts/migration/baselines.ts add-worktree pe my-task    # disposable worktree at the pin
mise exec node@26.13.0 -- node scripts/migration/baselines.ts remove-worktree pe my-task
```

- Clones live outside this working tree, in `../app-baselines/<system>`; `--root <dir>`
  moves them. Disposable worktrees live in `../app-baselines/worktrees/<system>-<name>`.
- Every command that touches a clone first checks that the remote tag still resolves to the
  pinned commit, and fails otherwise.
- `sync` and `add-worktree` refuse a clone whose `origin` differs from the pin or whose
  working tree is not clean; `add-worktree` also requires the clone to sit at the pinned
  commit. Installs, suite runs and characterization tests happen in worktrees; the clone
  stays pristine.
- Source repositories are read-only for agents (agent rule 1). Nothing here pushes to them.

## Toolchains

| System | Tool | Version | Source of the version |
| --- | --- | --- | --- |
| `pe` | Bun | 1.4.0 | `mise.toml`, `packageManager` |
| `pe` | Node | 24.22.2 | Not pinned by PE. Its Vitest and Playwright CLIs run on the `node` in `PATH`; 24.22.2 is the machine default PE was developed with. |
| `pe` | Playwright | 1.63.0, Chromium revision 1243 | `bun.lock`. Install the browser with `bunx playwright install chromium` in a worktree. |
| `grifando` | Node | 24.22.2 | `.nvmrc` says `24`; CI takes the newest 24.x. |
| `grifando` | pnpm | 12.3.4 | `packageManager` |
| `grifando` | Postgres | `postgres:17-alpine` (17.11, `sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24`) | `.github/workflows/ci.yml` and `docker-compose.yml` |

Docker must be running for the Grifando suite.

## Running the suites

```bash
mise exec node@26.13.0 -- node scripts/migration/baseline-run.ts pe
mise exec node@26.13.0 -- node scripts/migration/baseline-run.ts grifando
```

`baseline-run.ts` does the following:

1. Syncs the clone and creates a fresh worktree, `../app-baselines/worktrees/<system>-run`.
2. Fails if the worktree's `mise.toml`, `.nvmrc`, `packageManager`, lockfile or CI image no
   longer match the toolchain above. A baseline bump that changes the toolchain must update
   the run plan in the script and this file together.
3. Runs every command under a scrubbed environment: a private, empty `HOME` inside the run's
   scratch directory, `LANG`, `TERM`, a `PATH` of the pinned tools from mise, opt-outs for
   husky and telemetry, and the locations of three shared caches that hold no credentials:
   Bun's package cache, the pnpm store and the Playwright browsers. No credential, no
   credential file under the real home directory, and no AI key reaches baseline code. No
   suite needs one.
4. Installs with the frozen lockfile. For Grifando, starts a throwaway `postgres:17-alpine`
   container on a random loopback port, sets `DATABASE_URL` and `TEST_DATABASE_URL`, runs
   `pnpm db:test:prepare`, and removes the container at the end.
5. Runs each suite with a machine-readable reporter and stores the report in
   [`baseline-runs/<system>/`](./baseline-runs/), next to a `manifest.json` that records the
   pin, the run time, the tools, the services, each command and its exit code.
6. Normalizes the stored reports: paths inside the worktree become repo-relative, the private
   and the real home directory become `~`, and bun's junit `hostname` attribute is dropped.
   Nothing else changes.
7. Exits 1 when any suite fails. The reports are written either way.

The full log stays outside the repository, at the path the script prints.

| System | Suite | Directory | Command (report path elided) | Report |
| --- | --- | --- | --- | --- |
| `pe` | `server` | `apps/server` | `bun run test --reporter=junit` (`bun test ./src`) | `server.junit.xml` |
| `pe` | `db` | `packages/db` | `bun run test --reporter=junit` (`bun test ./src`) | `db.junit.xml` |
| `pe` | `env` | `packages/env` | `bun run test --reporter=default --reporter=json` (`vitest run`) | `env.vitest.json` |
| `pe` | `web` | `apps/web` | `bun run test --reporter=default --reporter=json` (`vitest run`) | `web.vitest.json` |
| `pe` | `e2e` | repository root | `bun run test:e2e --reporter=list,json` (build, then `playwright test`) | `e2e.playwright.json` |
| `grifando` | `vitest` | repository root | `pnpm exec vitest run --reporter=default --reporter=json` (the `test` script) | `vitest.json` |

## Recorded runs

Run on 2026-11-13 (UTC), counts as the reporters give them:

| System | Suite | Files | Tests | Passed | Failed |
| --- | --- | ---: | ---: | ---: | ---: |
| `pe` | `server` | 12 | 106 | 106 | 0 |
| `pe` | `db` | 1 | 2 | 2 | 0 |
| `pe` | `env` | 1 | 4 | 4 | 0 |
| `pe` | `web` | 13 | 65 | 64 | 1 |
| `pe` | `e2e` | 1 | 1 | 1 | 0 |
| `grifando` | `vitest` | 49 | 305 | 305 | 0 |

### Red baseline tests

A red test is marked `baseline-red` in the inventory. It cannot serve as spec until the
owners decide, through the `needs-info` issue linked here.

| System | Test | Cause | Decision request |
| --- | --- | --- | --- |
| `pe` | `apps/web/src/routes/-dashboard.test.tsx` › Writing Desk › keeps a completed Evaluation inline with complete evidence | Reads the wall clock. The fixture is dated 2026-09-01 and the dashboard counts the last 30 days, so the test has failed since about 2026-10-01. It passes with the clock set to 2026-09-15. | [#1](https://github.com/Fluenshift/app/issues/1) |

## Characterization tests

Behavior that no baseline test pins gets a characterization test before it is ported
(agent rule 5). The tests are kept in this repository, written in the baseline's own idiom,
and run at the pin:

```bash
mise exec node@26.13.0 -- node scripts/migration/characterization-run.ts pe
mise exec node@26.13.0 -- node scripts/migration/characterization-run.ts grifando
```

- Files live in `migration/characterization/<system>/files/<path>`, where `<path>` is their
  place inside the baseline, so relative imports work unchanged. Tests are named
  `*.characterization.test.ts` (or `.tsx`); helper files may sit beside them.
- The script creates a fresh worktree, `../app-baselines/worktrees/<system>-characterization`,
  installs under the same scrubbed environment as the suite runs, and copies the files in. It
  refuses to replace any baseline file, and fails if the run changed a tracked baseline file.
- Each test runs with the baseline suite that owns its directory (`filesRoot` in the run plan
  of `baseline-run.ts`), with that suite's machine-readable reporter. PE has no characterization
  suite for `e2e/`; Grifando's tests run with Vitest against the throwaway Postgres.
- Normalized reports and a manifest, which lists the copied files, go to
  `migration/characterization/<system>/reports/`. The script exits 1 when a characterization
  test fails: a red characterization pins nothing, and the inventory refuses it.
- `migration/**` is outside this repository's build, lint and format: the files are written
  for Bun, Elysia, Next.js and Prisma.

After a run, regenerate the inventory, then give the new cases ledger rows (agent rule 13: the
ledger belongs to the coordinator):

```bash
mise exec node@26.13.0 -- node scripts/migration/inventory.ts
mise exec node@26.13.0 -- node scripts/migration/ledger-add.ts --slice <slice> --class <A|B|C> <system>:characterization:<path>
```

| System | File | Pins | Cases |
| --- | --- | --- | ---: |
| `pe` | `apps/server/src/evaluation/utf8.characterization.test.ts` | `utf8.ts`, which has no test, and the UTF-8 edge cases of `applyCorrections`: a leading BOM, lone surrogates, code-point boundaries, the two rejection reasons. A port to `TextEncoder` and `TextDecoder` must keep a leading BOM, which a default `TextDecoder` drops. | 13 |
| `pe` | `apps/server/src/evaluation/protected-content.characterization.test.ts` | Two gaps of `protected-content.test.ts`: lines of JSON that only the JSON block pass protects, because they are not YAML, and the byte offsets of each span, which its cases never compare. | 2 |
| `grifando` | `src/server/domain/exercises/difficulty.characterization.test.ts` | The scale constants of `difficulty.ts`: the starting ability, the level ratings, the 400-point Elo scale, the K-factor and the 70% success target. The baseline tests only compare results with each other. | 5 |
| `grifando` | `src/server/domain/exercises/selection.characterization.test.ts` | How `selectReviewSet` splits an odd count: today's mistakes take the larger half. The baseline tests use even counts. | 1 |
| `grifando` | `src/server/domain/mistakes/mastery.characterization.test.ts` | `isFading` never flags an IMPROVING pattern. The baseline test checks an ACTIVE one. | 1 |
| `grifando` | `src/server/domain/mistakes/recall.characterization.test.ts` | `isDueForReview`, which no baseline test calls: its 0.5 threshold, and that a recall of exactly 0.5 is not due. | 1 |
| `grifando` | `src/lib/answerDiff.characterization.test.ts` | The punctuation `diffWords` ignores, and that it splits words on any whitespace. The baseline tests use single spaces and strip only periods and exclamation marks. | 2 |
| `grifando` | `src/server/domain/progress/streak.characterization.test.ts` | That a streak's week starts on Monday, and the 100 and 365 day milestones. The baseline tests never rest on a Sunday and reach 7 and 30 only. | 2 |
| `grifando` | `src/server/domain/writing/dailyPrompt.characterization.test.ts` | Which prompt fixed days get, which pins the day hash, and the prompt bank's copy. The baseline tests check only that a pick is stable and varies. | 2 |
| `grifando` | `src/server/domain/writing/technicalPrompts.characterization.test.ts` | The technical prompt bank's copy. The baseline tests check its shape only. | 1 |
| `grifando` | `src/server/ai/schemas/exerciseGeneration.characterization.test.ts` | Every bound of the exercise generation schema, at its limit and one past it; that undeclared properties are dropped; the out-of-range check at the last option; both error messages of `validateExerciseGenerationResult`. The baseline tests pin three bounds. | 8 |
| `grifando` | `src/server/domain/exercises/answerChecking.characterization.test.ts` | How a multiple-choice answer is read (`Number.parseInt` semantics, so a blank answer is never option 0); which trailing punctuation is stripped; whitespace collapsing; trimming before stripping; grading of rewrite and translation answers. | 6 |
| `grifando` | `src/server/domain/exercises/publicView.characterization.test.ts` | The whole public view of multiple-choice, rewrite and translation exercises. The baseline test pins fill-blank only. | 1 |
| `pe` | `apps/server/src/app.characterization.test.ts` | Every HTTP behavior of `app.ts` that `app.test.ts` leaves out; see the table below. | 27 |

PE's HTTP endpoints, by the test that pins each behavior (#21):

| Endpoint | `app.test.ts` | `app.characterization.test.ts` |
| --- | --- | --- |
| Every `/api/` response | `cache-control: no-store` on History and on every Evaluation failure | `no-store` on 403, 413, an unknown route and the setup status |
| Request guards | 403 for a remote host and a foreign Origin; 413 for a declared body over 256 KiB | the three loopback host names; 403 for a foreign Host header and a cross-site fetch; a same-origin fetch; the 403 and 413 bodies; a body of exactly 256 KiB passes |
| Unknown `/api/` route | 404 with a JSON content type under the browser fallback | the not-found body, with and without the browser fallback |
| `GET /api/health` | 200 and `{ status: "ok" }` | nothing more |
| `POST /api/evaluations` | 201 and the created Evaluation; the status of every failure code; no private text in failures; the log event without the sample; 400 for a mistyped field | 503 when Evaluation is not configured; the whole created, no-english and failure bodies; the invalid-request body for a body that is not JSON and for a missing field; a throwing evaluation (500 and an `internal-error` log); a throwing logger; the configured model in the log |
| `GET /api/evaluations` | 200 and the list; the safe 500 | 503 not-ready |
| `GET /api/evaluations/:evaluationId` | 200 and 404 | 503 not-ready; the not-found body |
| `DELETE /api/evaluations/:evaluationId` | 204 | 503 not-ready; the empty body |
| `GET /api/progress` | 200 for `7-days` | 503 not-ready; `30-days` and `all`; 400 invalid-period |
| `GET /api/progress/evidence` | 200 for `average-score` | 503 not-ready; `finding-rate`, category and correction selections; 400 invalid-selection |
| `GET /api/setup` | 200, part of the status | 503 not-ready; the whole status |
| `GET /*` browser fallback | immutable assets; uncached `index.html` | the bare not-found body for `/api/`; a missing asset; no file outside `assets/`; 404 for a request that is not a GET |
| HTTP idle timeout | 120 seconds | nothing more |
| `grifando` | `src/app/api/rateLimitFirst.characterization.test.ts` | Fix `9ba8040`: every state-changing route consults its rate limit before it creates the visitor's user, and which limit each route uses. | 1 |
| `grifando` | `src/lib/responseError.characterization.test.ts` | Fix `032c115`: `failedSessionIdFrom` reads the FAILED session id from a clone of the response. | 2 |
| `grifando` | `src/server/ai/aiErrorResponse.characterization.test.ts` | Fix `032c115`: a typed AI error's response carries its FAILED session id, and only when there is one. | 1 |
| `grifando` | `src/server/ai/client.characterization.test.ts` | Fix `80957b6`: the default model of each provider, the light fallback models, and that a key test runs on the fallback. | 3 |
| `grifando` | `src/server/domain/interview/interviewService.characterization.test.ts` | Fix `218b7b7` on the interview path: a failed answer returns its FAILED writing session, and a retry re-analyzes that session. | 1 |

Grifando's fix commits, by the test that pins each at the baseline (#23). A baseline test counts only if it fails once the fix is undone in a disposable worktree at the pin; every characterization above was checked the same way.

| Commit | Behavior | Pinned by |
| `0083c7f` | Gemini schemas drop array bounds and `$schema`. | `src/server/ai/providers/gemini.test.ts` › toGeminiSchema › drops array bounds and $schema that Gemini rejects, keeping the rest |
| `032c115` | A typed AI error keeps the FAILED session id, its response carries it, the client reads it, and `POST /api/exercises` maps typed AI errors. | `src/app/api/exercises/route.test.ts` › POST /api/exercises › maps a typed AI error from generation to its coded response; `src/server/domain/writing/writingCoachService.test.ts` › writingCoachService.submitWriting › leaves one FAILED session, exposes its id on a typed access error, and reuses it on retry; the `aiErrorResponse` and `responseError` characterizations. The screens that resubmit wait for the journeys of ADR 0001. |
| `218b7b7` | A retry re-analyzes the FAILED session instead of creating another. | `src/server/domain/writing/writingCoachService.test.ts` › writingCoachService.submitWriting › re-analyzes the failed session on retry instead of creating a duplicate, › leaves one FAILED session, exposes its id on a typed access error, and reuses it on retry, and › creates a new session when the retry id isn't a FAILED session of this user; the `interviewService` characterization. The screens wait for the journeys. |
| `2a86084` | `aiFetch` refuses absolute and protocol-relative URLs; saving a key reports blocked storage. | `src/lib/aiKeyStore.test.ts` › aiFetch › refuses absolute and protocol-relative URLs without calling fetch, and › saveAIKey reports false when storage throws. The settings form's message waits for the journeys. |
| `8b80767` | Exercise, interview and writing lookups are scoped to the session user. | `src/server/domain/exercises/exerciseService.test.ts` › exerciseAttemptService ownership › rejects another user's exercise and leaves the owner's data untouched; `src/server/domain/interview/interviewService.test.ts` › interview ownership › hides, refuses to answer and refuses to end another user's session; `src/server/domain/writing/writingSession.repository.test.ts` › writingSessionRepository.findByIdForUser › returns the owner's session and null for another user. Each fails once the lookups drop the owner. The routes' 404 for another user's id is in the scope of #22. |
| `9ba8040` | An `/api` request without a session gets 401 and mints no cookie, cron routes pass, and every state-changing route checks its rate limit before creating the user. | `src/proxy.test.ts` › proxy › answers 401 SESSION_REQUIRED to an /api request without a valid cookie and mints nothing, and › lets /api/cron requests through without a session or a new cookie; the `rateLimitFirst` characterization. The check of production secrets in `scripts/vercel-build.mjs` belongs to the Vercel build, which ADR 0003 replaces, and has no test. |
| `80957b6` | Gemini answers with `gemini-3.5-flash`, and a key test runs on the light fallback model. | the `client` characterization |
| `9f5e47e`, `397b0b4` | Spacing roles of `Field`, `Stack` and `Actions`; tall blocks revealed and `CountUp` without flicker. | UI only; they wait for ADR 0009 and the journeys. |
| `02f4ffd`, `8dc1a06`, `9e86e94`, `22b6067`, `648cf5d`, `cf0c6b6` | Tests, build and tooling only. | Nothing to pin. |

The `fix-commit` rows keep empty targets: a target is a test of this repository, and these tests run only at the baseline. The unit that ports each fix's behavior points its row at the ported tests.
