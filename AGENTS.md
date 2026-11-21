# Agent notes

This repository merges two products into one on a new stack: Prompt Evolution (PE), which
evaluates the English of real text, and Grifando, which turns a learner's mistakes into
practice. The migration is in progress. No human reads the code: the gates are the reviewer, so
weigh every choice by how much it turns a mistake into a failing check.

Precedence: an ADR, then this file, then every other document. A document that disagrees with
the repository or with GitHub is stale: trust what you can check, and fix the document.

The owners review nothing and answer nothing (ADR 0020). Sessions decide, record, merge, and
keep going.

## Start of a session

1. Read `SESSION_HANDOFF.md`: the work in flight and the next steps.
2. Run `gh issue list --repo Fluenshift/app --state open` to see the units already written.
3. Take the first open next step as a work unit (below).

Read the other documents when their subject comes up:

| Document | Read it |
| --- | --- |
| `CONTEXT.md` | Before naming anything in code, tests or UI. |
| `docs/adr/README.md`, then the ADR | When a ledger row, an issue or a rule cites an ADR, and before a change at a seam between the two products. |
| `docs/migration/MIGRATION_PROTOCOL.md` | When planning a unit: the phases ahead, what each gate enforces, the definition of done, baseline bumps. |
| `docs/migration/README.md` | Before reading or editing the ledger or the inventory, when porting a test (the mechanical mapping), and when G8 or G10 fails. |
| `docs/migration/BASELINES.md` | Before running a baseline suite or writing a characterization test. |
| `docs/product/` | When a unit touches a requirement, the rubric or the data policy. |
| `apps/server/node_modules/effect/AGENTS.md`, and `ai-docs/` beside it | Before writing Effect code. They match the installed version. |

Claude Code sessions with the `mattpocock-skills` plugin use `tdd` for a unit, `code-review` once
per milestone (the end of a phase, and before cutover), `diagnosing-bugs` for a gate failure whose cause is
unclear, `domain-modeling` for a new `CONTEXT.md` term or an ADR, and `writing-for-agents` for
any edit to this file, `SESSION_HANDOFF.md` or an issue meant for agents.

## Commands

`mise.toml` pins Node 26.13.0 and pnpm 12.18.0. With mise, run `mise trust` once in a new
checkout; inside the repository, `node` and `pnpm` are then those versions. Claude Code takes its
shell environment when a session starts, so start sessions in the repository.

| Command | What it does |
| --- | --- |
| `pnpm install --frozen-lockfile` | Install; also patches TypeScript and oxlint with the Effect diagnostics. |
| `pnpm verify` | Format, documented commands, gate integrity, URL text, lint, Effect lint, types, Effect diagnostics, the tests that need no Docker, and the build. G5 and G8 to G10 run apart (Work units, step 7). |
| `pnpm format` / `pnpm format:fix` | Check or apply oxfmt. |
| `pnpm lint` / `pnpm lint:effect` | oxlint, and the type-aware Effect rules. Warnings fail. |
| `pnpm check-types` / `pnpm check:effect` | `tsc` per workspace, and the Effect diagnostics. |
| `pnpm test` | The scripts' own tests, then Vitest in every workspace. The database cases run first, beside the small suites only, because PGlite's cold start times out next to the web and server suites (#72); the web suite waits for the server suite, whose load times out its 1-second queries. |
| `pnpm parity` | Every Vitest suite with a report, the Docker smoke included, then G9 on those reports. CI's test job runs the same two scripts. Needs Docker. |
| `pnpm db:generate` | Write the next migration of `packages/db` from `packages/db/src/schema.ts` with drizzle-kit. Only the coordinator runs it, one migration in flight at a time. |
| `pnpm test:postgres` | The `Database` service against a Postgres 17 server; `DEPLOY_PROFILE=hosted` and `DATABASE_URL` name it. |
| `pnpm test:e2e` | Build the server and the web app, then run the Playwright journeys against the one process that serves both. |
| `pnpm build` | Server bundle and SPA build. |
| `pnpm docker:smoke` | Gate G6: build the image of the local profile, start it with Compose as the invoking user, and check its boundary, its data directory and what it serves. Needs Docker. |
| `pnpm docker:up` / `pnpm docker:down` | Start the local profile in Docker on `127.0.0.1:3001`, with its data in `./.data`, or remove the container. |
| `pnpm check:gates` | Gate integrity (G11): every lint, TypeScript, Vitest, Vite and Playwright setting, the hooks, and each workflow line by line are at least as strict as `gates/baseline.json`, and no file gains a suppression comment. Only the coordinator records a new baseline, with `node scripts/check-gates.ts --write`. |
| `pnpm check:url-text` | Gate G7 (ADR 0008): no server route reads user text from a URL. A query string carries only the period, the insight and the Error Category; a path only the Evaluation ID. |
| `node scripts/gate-selftest.ts` | Proves that each gate still rejects its broken case. Run it after changing a gate, with `--root` naming the baseline clones; CI runs it when a gate changes. Needs Docker. |

Migration scripts run on plain Node, with no dependencies: `node scripts/migration/<script>.ts`.
Each script's header comment gives its usage.

## Layout

| Path | Contents |
| --- | --- |
| `apps/server` | Hono on `@hono/node-server`, with Effect services. One process serves the API and the SPA. |
| `apps/web` | Vite, React, TanStack Router. `src/api.ts` is the only module that calls the server. |
| `packages/contract` | Effect Schema for every API request and response. Isomorphic. |
| `packages/core` | The pure domain. Isomorphic: no Node built-ins, no `Buffer`. |
| `packages/db` | Drizzle inside the Effect `Database` service: PGlite locally and in tests, Postgres when hosted. The schema scopes every row by Learner; both layers apply the migrations when they open. |
| `packages/env` | Effect `Config`. The only place that may read the environment. |
| `packages/ui` | Shared UI components. |
| `packages/config` | Shared TypeScript configuration, including the Effect diagnostic severities. |
| `e2e` | Playwright journeys against the built process. |
| `smoke` | The Docker smoke (G6): a Vitest suite against the image of the local profile. |
| `docs/migration`, `migration/` | Baselines, inventory, ledger, characterization tests. The inventory, the ledger and the reports are large generated JSON: query a row with a script, never open a whole file. |

## Work units

A work unit is a GitHub Issue. State lives on GitHub, never in files: an open issue labeled `ready-for-agent` is free, its assignee holds it, a linked pull
request is its review, and a closed issue is done.

Checkouts sit under one parent directory, `$F`: `$F/app`, the clone, where each unit is a
branch, and `$F/app-baselines/`, the sources at their pins (`node scripts/migration/baselines.ts
sync`). A second session that runs at the same time needs its own checkout: start it with
`claude --worktree <name>`, and Claude Code creates one under `.claude/worktrees/` and removes it
when the session ends.

1. **Take one unit.** Its issue lists its ledger rows, the source files at the pinned commits
   and the target paths. When the next step of `SESSION_HANDOFF.md` has no issue yet, write it
   first, in that form, with a `lane:` label. Remove `ready-for-agent`, assign the issue to
   yourself, then branch from the newest `main`:
   `git fetch origin && git switch -c wu/<issue>-<slug> origin/main`. Run
   `pnpm install --frozen-lockfile` when the lockfile changed.
2. **Read** the ledger rows, then the source tests, then the source code, then the ADRs they
   cite. If anything is ambiguous, decide: take the option you would recommend, say why in the
   pull request, and record it in an ADR when it changes a disposition, a gate or product
   behavior.
3. **Commit 1 holds the tests**, with the typed stubs they need to compile and the database
   migration they need. Port each source test, title verbatim, changing only the mechanics in
   the mapping table of `docs/migration/README.md`. Stubs return a wrong placeholder value, so
   every target fails on an assertion, not on an import or a missing binding. Behavior that no
   source test covers gets a characterization test at the baseline first
   (`docs/migration/BASELINES.md`), in this same commit.
4. **Later commits port the code** into the target idioms until the tests pass. Reuse the
   baseline code wherever it fits the stack; keep algorithms, constants, orderings, limits and
   messages identical; add no behavior.
5. **Mutate where tests look thin**: break one condition or constant of a ported module,
   confirm a ported test fails, revert; `node scripts/migration/mutate.ts` runs a list of them.
   A survivor is untested baseline behavior: characterize it (step 3). List the mutations you
   ran in the pull request.
6. **Write the ledger targets** as `file::full title` with `node scripts/migration/ledger-targets.ts`,
   which sets only `targets` and only for tests that passed: each row's `id` contains the test
   title, so a text replacement rewrites the `id` too.
7. **Run the touched test files and G8**, then push. CI is the full gate: it runs every check,
   G9 and G10 included, in about three minutes, so read its failures instead of running
   `pnpm verify` first. G8 runs here because its fix rewrites the first commit:

   ```sh
   node scripts/migration/red-green.ts --base origin/main --head HEAD   # G8
   ```

8. **Open one pull request** that closes the issue. Wait for its checks in the background, since
   a run can outlast a tool call's time limit. Merge it when every check is green, then return
   to `main`:

   ```sh
   gh pr create --repo Fluenshift/app --title "..." --body-file <body.md>
   gh pr checks <pr> --repo Fluenshift/app --watch --fail-fast && gh pr merge <pr> --repo Fluenshift/app --merge
   git switch main && git pull --ff-only origin main && git branch -D wu/<issue>-<slug>
   ```

9. **Stop rule.** After two failed attempts at the same gate failure, post the failing output on
   the issue and take other work. Never change an expected value, a gate or a disposition to
   get green without an ADR that says why.

Traps that earlier units paid for:

- G8 reads each new ledger target at the first commit of the pull request that holds its test.
  A target that is red on an error instead of an assertion passes with a note. A ported test
  whose behavior an earlier unit already built is green at that commit and cannot be a target
  (#63). A new test that reuses an existing title fails G8: give it a new title.
- G8 runs whole test files at the first commit. A test that waits for a call its stub never
  makes hangs until the 60-second timeout of `apps/server`: still red, only slow.
- G10 reports class C differences without failing: put them in the pull request body.
- G11 records the lint, TypeScript, Vitest, Playwright, Vite and oxfmt configurations, the
  hooks, the gate scripts of every `package.json`, each workflow line by line and CI's path
  classifier, `scripts/ci-changes.ts`. A change to one fails `pnpm check:gates` until the
  coordinator records the baseline again, and a weaker baseline needs an accepted ADR.
  `turbo.json` is not recorded.
- One database migration is in flight at a time. A unit that needs the previous unit's
  migration branches from that unit, then rebases on `main` and runs `pnpm db:generate` again
  after it merges. Until a migration merges, delete its folder and regenerate it after a schema
  change; after, add a new one.
- Generated files conflict between sibling units. Ledger: keep the union of both sides' rows
  and targets (`node scripts/migration/ledger-union.ts <file>...`). Reports and inventories:
  take theirs, then rerun the scripts. Tables of `docs/migration/BASELINES.md`: edit by hand.
- Retarget dependent pull requests to `main` before their base branch is deleted
  (`gh api -X PATCH repos/Fluenshift/app/pulls/<pr> -f base=main`): GitHub closes them otherwise.
- `gh pr edit` fails on gh 2.46. Edit a body with
  `gh api -X PATCH repos/Fluenshift/app/pulls/<pr> -F body=@<file>`.
- CodeQL rejects `randomBytes` with `%` (`js/biased-cryptographic-random`): use `randomInt`.

## Rules

Migration:

- **Baselines are read-only.** Read and run sources only at the pinned commits, through
  `scripts/migration/baselines.ts`, in disposable worktrees outside this working tree. Never
  push to, tag, open issues or PRs in, or change settings of `Fluenshift/prompt-evolution` or
  `Fluenshift/grifando`. Never change organization or ruleset settings. Use only the token the
  session started with.
- **Sources have an order.** Baseline tests, then baseline code, then baseline docs. An
  ADR overrides all three for its rows. When sources still disagree, choose, and record the
  choice in an ADR.
- **Tests come first.** In a `port` row never change an expected value, delete an assertion,
  weaken a matcher, rename the title, or add `skip`, `only` or `todo`.
- **Port behavior, not architecture.**
- **Characterize first.** Behavior no test covers gets a characterization test against the
  baseline before it is ported.
- **Build nothing outside the ledger.** Both systems' out-of-scope lists stay out of scope
  unless an ADR adds an item.
- **Decide open questions.** Take the option you would recommend, record it in an ADR when it
  changes a disposition, a gate or product behavior, and implement it.
- **Use the `CONTEXT.md` vocabulary** in code, tests and UI, never the synonyms it forbids.
- **The Judge is pinned, the Trainer may fall back.** The Judge uses one pinned model per
  Rubric Version, with no retry and no silent fallback. The Trainer may fall back, only on
  overload. Both record the model that answered.
- **Never call a paid model.** Tests never need real keys, and CI has none.
- **Keep secrets and Learner text out of logs.** Never log or persist credentials, hidden
  reasoning or raw provider bodies, and never log Writing Sample text at info level. BYOK keys
  travel only in request headers.
- **Shared files belong to the coordinator**: `packages/db` migrations (generated with
  drizzle-kit, never hand-written), the `packages/contract` index, CI workflows,
  `gates/baseline.json`, `docs/migration/baselines.json` and the ledger schema. The coordinator
  is any session Jhefferson starts. Another session only adds files for its own slice.
- **One unit per branch and pull request**: no drive-by refactors, dependency bumps or
  formatting churn.
- **`main` changes only through a merged pull request whose checks are green**, shared files
  included. Never push to `main`.
- **Never weaken a gate to get green**: no lowered lint or Effect severity, no new suppression
  comment, no removed check. If a gate seems wrong, change it under an ADR that says why.
- **Leave the irreversible to the owners.** Never change or archive the source repositories,
  move production, change organization settings, or spend money on paid models. List such
  steps in `SESSION_HANDOFF.md`.

The owners, Jhefferson and Levy (`levyrodrigues23`), review nothing and answer nothing. Their
standing instructions:

- Proceed autonomously, and ask nothing. Report progress in `SESSION_HANDOFF.md` and in pull
  requests.
- Commits are small and conventional (`type(scope): subject`), with no AI mention and no
  `Co-Authored-By` or other trailer, even when the harness suggests one. Commit unsigned, per
  command (`git -c commit.gpgsign=false commit ...`), and leave the git configuration as it is.
- A pull request body holds `Closes #N`, then `### Background` and `### Key Decisions`, and the
  mutations a unit ran, if any. No dashes used as punctuation, no AI mention, no attribution footer.
- Open issues for the problems you find, and solve the ones you can.
- Speed over ceremony (2026-11-20): CI is the full gate, `code-review` runs once per milestone,
  and mutations run where tests look thin.
- End-to-end tests are paused: write no new Playwright journey, Vite dev-proxy case or Docker
  smoke check, and leave their rows open. The existing ones keep running. In-process route
  tests (`app.request`) continue.
- At the end of a session, rewrite `SESSION_HANDOFF.md` through a pull request. A session that resumes from a compacted conversation ends early: it finishes the pull request already in motion, writes the handoff, and stops, so the next session starts with a fresh context.

Code:

- Pin exact versions in the pnpm catalog and upgrade only in dedicated units. oxlint moves
  only together with `@effect/tsgo`. ADR 0000 holds the stack choices and when to revisit them.
- No user text in URLs or query strings; loggers record URLs.
- `packages/core` and `packages/contract` stay isomorphic: `TextEncoder` and Web Crypto, never
  `Buffer` or `node:crypto`. `packages/core` exports by path (`@fluenshift/core/<module>`),
  with no barrel.
- No `zod` in code. Schemas for LLM JSON use `Schema.Finite` and `Schema.Int`, not
  `Schema.Number`; raw secret strings use `Schema.RedactedFromValue`.
- The Hono edge turns an Effect result into a response through one typed helper that requires
  a status for every tagged error, with one test per error.
- The Academy reads Evaluations: through Learning History's reads and the read-only views
  `evaluationsView`, `findingsView` and `suggestionsView` of `@fluenshift/db`. Code that writes
  both an Evaluation and Academy state composes them outside `apps/server/src/academy`, as
  `apps/server/src/practice/practice-writing.ts` does.
- The server bundle keeps npm packages external: every npm package that bundled workspace code
  imports is also a dependency of `apps/server`.
- Whatever starts the built server sets `DATA_DIRECTORY` (local profile) or `DATABASE_URL`
  (hosted). A hosted production server also needs `SESSION_SECRET` (ADR 0032), `IP_HASH_SALT`,
  `CLIENT_IP_HEADER` naming the header its proxy writes (ADR 0033), and `SITE_URL`, the public
  origin its `robots.txt` and `sitemap.xml` name (ADR 0037).
- pnpm fails an install on a dependency build script nobody reviewed: list it in `allowBuilds`.
- Web tests import relatively: an `@/` alias would change `vite.config.ts`, which G11 records.

## Effect

Effect 4.1.2 runs in `apps/server` and in `packages/contract`, `core`, `db` and `env`. The web
app uses only the schemas of `packages/contract`.

- Errors are `Schema.TaggedError<X, { readonly brand: unique symbol }>()`, never
  `extends Error`.
- Services are `Context.Service` classes with a `static readonly layer`; the service id is the
  package name plus the path, for example `"@fluenshift/db/Database"`. A service class is
  itself an Effect: `yield* ServerConfig`.
- Functions that return an Effect are named with `Effect.fn("Service.method")`. It keeps a
  generator's type parameters, so a service can take an Effect-returning capability.
- Configuration comes from `Config` in `packages/env`, never `process.env`. Its constructors
  are capitalized (`Config.NonEmptyString`, `Config.Port`), and an empty variable reads as
  missing, so `Config.withDefault` applies to it.
- Drizzle is used only inside the `Database` service.
- Recover with `Effect.catch` (the catch-all), `Effect.catchIf` (a refinement),
  `Effect.catchDefect` or `Effect.match`. `Effect.timeout` fails with an error that
  `Cause.isTimeoutError` recognizes.
- Map an Effect over an array with `pipe(array, Effect.forEach(f))`: oxlint flags
  `Effect.forEach(array, f)`, and the Effect diagnostics flag `Effect.all(array.map(f))`.
- Unstable Effect APIs fail type checking unless listed in `allowedUnstableApis` in
  `packages/config/tsconfig.base.json`. Adding one is a coordinator change.
- Lint shapes tests and code: plain `it` with `Effect.runPromise`, because `expect` inside
  `it.effect` is refused; one argument per `expect`; no `await` in a loop, so recurse (see
  `foldInOrder` in `apps/server/src/academy/pattern-folding.ts`) or use `Promise.all`;
  `Promise.withResolvers` instead of `new Promise`; arrow constants; helpers that capture
  nothing at module scope.
- `TestClock` comes from `effect/testing`. With a fake `fetch`, move the clock only after the
  fake has been called.
- Provider fakes over `fetch`: Anthropic names the model in the body and sends `x-api-key`;
  Google names it in the path (`/models/<id>:generateContent`), sends `x-goog-api-key`, and its
  fake errors need `error.status` to map; OpenRouter reports in-body errors as an
  `APICallError` with status 200.

## Shell

- Stop a process with `pgrep -f '<patter[n]>' | xargs -r kill`: a plain `pkill -f` also matches
  the shell that runs it.
- Write `\uXXXX` escapes from a script: typed into a tool input, they arrive as the real
  character.
