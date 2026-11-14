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
| `grifando` | `src/app/api/exercises/exercises.characterization.test.ts` | `GET` and `POST /api/exercises` beyond the AI error cases of `route.test.ts`; see the table below. | 6 |
| `grifando` | `src/app/api/exercises/[id]/attempts/attempts.characterization.test.ts` | Grading and explaining an attempt; neither route has a test. | 6 |
| `grifando` | `src/app/api/interview/interview.characterization.test.ts` | The four interview routes; none has a test. | 6 |
| `grifando` | `src/app/api/me/me.characterization.test.ts` | The attributes the session cookie is expired with. | 1 |
| `grifando` | `src/app/api/vocabulary/vocabulary.characterization.test.ts` | Saving and deleting a vocabulary item; neither route has a test. | 3 |
| `grifando` | `src/app/api/writing-sessions/writingSessions.characterization.test.ts` | Submitting, listing and reading writing sessions beyond the missing-key cases of `route.test.ts`. | 6 |

Grifando's API routes, by the test that pins each behavior (#22). The characterizations run the
handlers against the throwaway Postgres, with the session, the rate limit and the AI provider
faked as the existing route tests fake them; the rate-limit refusals are in
`rateLimitFirst.characterization.test.ts` (#23).

| Route | Baseline test | Characterization |
| --- | --- | --- |
| `POST /api/ai-key/test` | `route.test.ts`: works, invalid, busy, timeout, malformed key, rate limit, missing key | nothing more |
| `GET /api/cron/cleanup` | `route.test.ts`: missing, wrong and unset secret; the counts | nothing more |
| `GET /api/exercises` | none | the public view of pending exercises, only the visitor's, and none once answered |
| `POST /api/exercises` | `route.test.ts`: missing key, typed AI error | 400 with issues, 422 before any pattern, 201 with public views, safe 500 |
| `POST /api/exercises/[id]/attempts` | none | 200 with the grade and the whole exercise, 400 with issues, 404 for unknown and foreign exercises |
| `POST /api/exercises/[id]/attempts/[attemptId]/explanation` | none | 200 with the explanation, 401 without a key, 404, and 502, 500 or the AI code when explaining fails |
| `POST /api/interview` | none | 201 with the session and its opening turn, 401 without a key |
| `GET /api/interview/[id]` | none | the session with its turns, 404 for unknown and foreign sessions |
| `POST /api/interview/[id]/turns/[turnId]/answer` | none | answered with the analysis and the next turn, failed with its session, 400 with issues, 404 for a foreign turn |
| `POST /api/interview/[id]/end` | none | `{ status: "ended" }`, 404 for unknown and foreign sessions |
| `DELETE /api/me` | `route.test.ts`: 204, the cookie's name and expiry, rate limit | the cookie's attributes, with `Secure` in production only |
| `POST /api/vocabulary` | none | 201 with the item, 400 with issues |
| `DELETE /api/vocabulary/[id]` | none | 204 with no body, 404 for unknown and foreign items |
| `POST /api/writing-sessions` | `route.test.ts`: missing and malformed key | 201 with the analyzed session (field by field), 201 with a failed session, 400 with issues |
| `GET /api/writing-sessions` | none | newest first, at most 20, only the visitor's, without analyses |
| `GET /api/writing-sessions/[id]` | none | the session with its analysis, 404 for unknown and foreign sessions |

The five pages that read repositories in Server Components (`/`, `mistakes`, `vocabulary`,
`today`, `write`) are not characterized yet; #22 stays open for them.
