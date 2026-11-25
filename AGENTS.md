# Agent notes

This repository is Grifando: one product, on one stack, from two. Prompt Evolution (PE)
evaluated the English of real text, and old Grifando, whose name the product took (ADR 0045),
turned a learner's mistakes into practice. Text older than ADR 0045 says Fluenshift for the
product and Grifando for old Grifando. The merge is done (ADR 0044). Next, the owners redesign
the interface and decide which features stay, change or go (#320). No human reads the code: the
gates are the reviewer, so weigh every choice by how much it turns a mistake into a failing
check.

Precedence: an ADR, then this file, then every other document. A document that disagrees with
the repository or with GitHub is stale: trust what you can check, and fix the document.

The owners review nothing and answer nothing (ADR 0020). Sessions decide, record, merge, and
keep going.

## Start of a session

1. Run `gh issue list --repo Fluenshift/grifando --state open`. The issues are the work, and each
   one's comments hold its state.
2. Triage every open `needs-triage` issue first, oldest first. Owner feedback arrives that way,
   or in a session's chat, which the session files as such an issue first. Edit it into a unit
   (the files it touches, a `lane:` label), remove `needs-triage`, and take it or label it
   `ready-for-agent`; or close it with the reason.
3. Take the oldest open `ready-for-agent` issue as a work unit. An issue assigned to an owner,
   such as #320, is theirs: leave it.
4. List the open CodeQL alerts (`gh api 'repos/Fluenshift/grifando/code-scanning/alerts?state=open'`).
   An alert on `main` blocks nothing, so it can sit unseen: open an issue for each.

Read the other documents when their subject comes up:

| Document | Read it |
| --- | --- |
| `CONTEXT.md` | Before naming anything in code, tests or UI. |
| `docs/adr/README.md`, then the ADR | When an issue or a rule cites an ADR, and before a change at a seam between the two products. |
| `docs/engineering-notes.md` | Before a change to a seam, the hosted profile, the Academy, the PE import, Protected Technical Content, the Docker smoke or CI. |
| `docs/product/` | When a unit touches a requirement, the rubric or the data policy. |
| `apps/server/node_modules/effect/AGENTS.md`, and `ai-docs/` beside it | Before writing Effect code. They match the installed version. |

Claude Code sessions with the `mattpocock-skills` plugin use `tdd` for a unit, `code-review` once
per milestone (a finished feature, and before a deploy), `diagnosing-bugs` for a gate failure
whose cause is unclear, `domain-modeling` for a new `CONTEXT.md` term or an ADR, and
`writing-for-agents` for any edit to this file, `docs/engineering-notes.md` or an issue meant
for agents.

## Commands

`mise.toml` pins Node 26.13.0 and pnpm 12.18.0. With mise, run `mise trust` once in a new
checkout; inside the repository, `node` and `pnpm` are then those versions. Claude Code takes its
shell environment when a session starts, so start sessions in the repository.

| Command | What it does |
| --- | --- |
| `pnpm install --frozen-lockfile` | Install; also patches TypeScript and oxlint with the Effect diagnostics. |
| `pnpm verify` | Format, documented commands, gate integrity, URL text, lint, Effect lint, types, Effect diagnostics, the tests that need no Docker, and the build. G5, G6 and G7's scans run apart, in CI. |
| `pnpm format` / `pnpm format:fix` | Check or apply oxfmt. |
| `pnpm lint` / `pnpm lint:effect` | oxlint, and the type-aware Effect rules. Warnings fail. |
| `pnpm check-types` / `pnpm check:effect` | `tsc` per workspace, and the Effect diagnostics. |
| `pnpm test` | The scripts' own tests, then Vitest in every workspace. The database cases run first, beside the small suites only, because PGlite's cold start times out next to the web and server suites (#72); the web suite waits for the server suite, whose load times out its 1-second queries. |
| `pnpm db:generate` | Write the next migration of `packages/db` from `packages/db/src/schema.ts` with drizzle-kit. Only the coordinator runs it, one migration in flight at a time. |
| `pnpm test:postgres` | The `Database` service against a Postgres 17 server; `DEPLOY_PROFILE=hosted` and `DATABASE_URL` name it. |
| `pnpm test:e2e` | Build the server and the web app, then run the Playwright journeys against the one process that serves both. |
| `pnpm build` | Server bundle and SPA build. |
| `pnpm docker:smoke` | Gate G6: build the image and start it with Compose twice: in the local profile as the invoking user, to check its boundary, its data directory and what it serves, and in the hosted profile beside Postgres, to check its session cookie, CSP header, robots and sitemap. Needs Docker. |
| `pnpm docker:up` / `pnpm docker:down` | Start the local profile in Docker on `127.0.0.1:3001`, with its data in `./.data`, or remove the container. |
| `pnpm check:gates` | Gate integrity (G11): every lint, TypeScript, Vitest, Vite and Playwright setting, the hooks, and each workflow line by line are at least as strict as `gates/baseline.json`, and no file gains a suppression comment. Only the coordinator records a new baseline, with `node scripts/check-gates.ts --write`. |
| `pnpm check:url-text` | Gate G7 (ADR 0008): no server route reads user text from a URL. A query string carries only the period, the insight and the Error Category; a path only the Evaluation ID and the Academy's record IDs (ADR 0023). |
| `node scripts/gate-selftest.ts` | Proves that each gate still rejects its broken case. Run it after changing a gate; CI runs it when a gate changes. |

The scripts in `scripts/` run on plain Node, with no dependencies. Each script's header comment
gives its usage.

## Layout

| Path | Contents |
| --- | --- |
| `apps/server` | Hono on `@hono/node-server`, with Effect services. One process serves the API and the SPA. |
| `apps/web` | Vite, React, TanStack Router. `src/api.ts` is the only module that calls the server. |
| `packages/contract` | Effect Schema for every API request and response. Isomorphic. |
| `packages/core` | The pure domain. Isomorphic: no Node built-ins, no `Buffer`. |
| `packages/db` | Drizzle inside the Effect `Database` service: PGlite locally and in tests, Postgres when hosted. The schema scopes every row of Learner data by Learner (the hosted rate-limit windows key on a Learner or a hashed IP, ADR 0033); both layers apply the migrations when they open. |
| `packages/env` | Effect `Config`. The only place that may read the environment. |
| `packages/ui` | Shared UI components. |
| `packages/config` | Shared TypeScript configuration, including the Effect diagnostic severities. |
| `e2e` | Playwright journeys against the built process. |
| `smoke` | The Docker smoke (G6): Vitest suites against the image in the local and the hosted profile. |
| `docs/adr`, `docs/product` | The decisions, and the requirements, rubric, data policy and asset licenses. |
| `scripts`, `gates` | The gate scripts and G11's baseline. |

## Gates

| Gate | What it enforces |
| --- | --- |
| G1 Types | `tsc` with the Effect diagnostics at error severity, in every workspace. |
| G2 Lint and format | Type-aware oxlint with the Effect rules, and `oxfmt --check`. Bans focused and skipped tests, Node built-ins in `packages/core` and `packages/contract`, `zod`, `process.env` outside `packages/env`, and Academy writes to Evaluation data. |
| G3 Tests | Vitest in every workspace, on PGlite databases, and the `Database` service against Postgres 17. |
| G4 Build | The server bundle and the SPA build. |
| G5 E2E | Playwright journeys against the built process. |
| G6 Docker smoke | The image in the local profile (loopback-only publication, hostile Host and Origin headers, data surviving container replacement, no secret in assets or logs) and in the hosted profile (session cookie, CSP header, robots and sitemap). |
| G7 Privacy and supply chain | gitleaks over the whole history, `pnpm audit --prod --audit-level high`, and no user text in a URL (ADR 0008). |
| G11 Gate integrity | Every gate setting at least as strict as `gates/baseline.json`; no new suppression comment. |
| G13 Live calibration | Deferred until the owners schedule it: paid, with frozen fixtures and a budget. |

G8, G9 and G10 checked the migration's ledger and retired with it (ADR 0044); G12 retired
earlier (ADR 0019). CI runs each suite once per run, and two rules skip work that cannot fail
(`scripts/ci-changes.ts`): a change that is only Markdown outside the workspaces runs the static
checks and G7 alone, and the gate self-tests run only when a gate changes.

## Work units

A work unit is a GitHub Issue. State lives on GitHub, never in files: an open issue labeled
`ready-for-agent` is free, its assignee holds it, a linked pull request is its review, and a
closed issue is done.

Checkouts sit under one parent directory, `$F`; `$F/grifando` is the clone, where each unit is a
branch. A second session that runs at the same time needs its own checkout: start it with
`claude --worktree <name>`, and Claude Code creates one under `.claude/worktrees/` and removes it
when the session ends.

1. **Take one unit.** When the work has no issue yet, write it first, with a `lane:` label: what
   to build, the files it touches, and when it is done. Remove `ready-for-agent`, assign the
   issue to yourself, then branch from the newest `main`:
   `git fetch origin && git switch -c wu/<issue>-<slug> origin/main`. Run
   `pnpm install --frozen-lockfile` when the lockfile changed.
2. **Read** the issue, the code it touches and the ADRs they cite. If anything is ambiguous,
   decide: take the option you would recommend, say why in the pull request, and record it in an
   ADR when it changes product behavior or a gate.
3. **Commit 1 holds the tests**, with the typed stubs they need to compile and the database
   migration they need. Stubs return a wrong placeholder value, so every new test fails on an
   assertion, not on an import or a missing binding.
4. **Later commits write the code** until the tests pass.
5. **Mutate where tests look thin**: break one condition or constant of the new code, confirm a
   test fails, revert. List the mutations you ran in the pull request.
6. **Run the touched test files**, then push. CI is the full gate: it runs every check in about
   three minutes, so read its failures instead of running `pnpm verify` first.
7. **Open one pull request** that closes the issue. Wait for its checks in the background, since
   a run can outlast a tool call's time limit. Merge it when every check is green, then return
   to `main`:

   ```sh
   gh pr create --repo Fluenshift/grifando --title "..." --body-file <body.md>
   gh pr checks <pr> --repo Fluenshift/grifando --watch --fail-fast && gh pr merge <pr> --repo Fluenshift/grifando --merge
   git switch main && git pull --ff-only origin main && git branch -D wu/<issue>-<slug>
   ```

8. **Stop rule.** After two failed attempts at the same gate failure, post the failing output on
   the issue and take other work. Never change an expected value or a gate to get green without
   an ADR that says why.

Traps that earlier units paid for:

- A `gh pr checks --watch` started seconds after `gh pr create` can exit on CodeQL's checks alone
  while CI is still queued. Before merging, list the checks and see the CI jobs green.
- G11 records the lint, TypeScript, Vitest, Playwright, Vite and oxfmt configurations, the
  hooks, the gate scripts of every `package.json`, each workflow line by line and CI's path
  classifier, `scripts/ci-changes.ts`. A change to one fails `pnpm check:gates` until the
  coordinator records the baseline again (`node scripts/check-gates.ts --write`), and a weaker
  baseline needs an accepted ADR. `turbo.json` is not recorded.
- One database migration is in flight at a time. A unit that needs the previous unit's
  migration branches from that unit, then rebases on `main` and runs `pnpm db:generate` again
  after it merges. Until a migration merges, delete its folder and regenerate it after a schema
  change; after, add a new one.
- Retarget dependent pull requests to `main` before their base branch is deleted
  (`gh api -X PATCH repos/Fluenshift/grifando/pulls/<pr> -f base=main`): GitHub closes them otherwise.
- `gh pr edit` fails on gh 2.46. Edit a body with
  `gh api -X PATCH repos/Fluenshift/grifando/pulls/<pr> -F body=@<file>`.
- CodeQL rejects `randomBytes` with `%` (`js/biased-cryptographic-random`): use `randomInt`.
- A comment that cites `migration/...` or `docs/migration/...` names a file that git history
  keeps: `git show 8a379e2:<path>` (ADR 0044).

## Rules

- **Decide open questions.** Take the option you would recommend, record it in an ADR when it
  changes product behavior or a gate, and implement it.
- **Use the `CONTEXT.md` vocabulary** in code, tests and UI, never the synonyms it forbids.
- **The Judge is pinned, the Trainer may fall back.** The Judge uses one pinned model per
  Rubric Version, with no retry and no silent fallback. The Trainer may fall back, only on
  overload. Both record the model that answered.
- **Never call a paid model.** Tests never need real keys, and CI has none.
- **Keep secrets and Learner text out of logs.** Never log or persist credentials, hidden
  reasoning or raw provider bodies, and never log Writing Sample text at info level. BYOK keys
  travel only in request headers.
- **Shared files belong to the coordinator**: `packages/db` migrations (generated with
  drizzle-kit, never hand-written), the `packages/contract` index, CI workflows and
  `gates/baseline.json`. The coordinator is any session Jhefferson starts. Another session only
  adds files for its own unit.
- **One unit per branch and pull request**: no drive-by refactors, dependency bumps or
  formatting churn.
- **`main` changes only through a merged pull request whose checks are green**, shared files
  included. Never push to `main`.
- **Never weaken a gate to get green**: no lowered lint or Effect severity, no new suppression
  comment, no removed check. If a gate seems wrong, change it under an ADR that says why.
- **Leave the irreversible to the owners.** Never change or archive the source repositories
  (`Fluenshift/prompt-evolution`, `Fluenshift/old-grifando`), move production, change organization
  or ruleset settings, or spend money on paid models. ADR 0044 lists what waits for the owners;
  a new such step goes on the issue that needs it. Use only the token the session started with.

The owners, Jhefferson and Levy (`levyrodrigues23`), review nothing and answer nothing. Their
standing instructions:

- Proceed autonomously, and ask nothing. Report progress in pull requests and on issues.
- Commits are small and conventional (`type(scope): subject`), with no AI mention and no
  `Co-Authored-By` or other trailer, even when the harness suggests one. Commit unsigned, per
  command (`git -c commit.gpgsign=false commit ...`), and leave the git configuration as it is.
- A pull request body holds `Closes #N`, then `### Background` and `### Key Decisions`, and the
  mutations a unit ran, if any. No dashes used as punctuation, no AI mention, no attribution footer.
- Open issues for the problems you find, and solve the ones you can.
- Speed over ceremony (2026-11-20): CI is the full gate, `code-review` runs once per milestone,
  and mutations run where tests look thin.
- The interface will be redesigned (ADR 0043, #320): write no new Playwright journey for the
  current pages; checks of the server, its container and its data go on as usual.
- At the end of a session, leave the state of every unit in motion on its issue: a comment with
  what is done and what is next. A session that resumes from a compacted conversation finishes
  the pull request already in motion, comments on its issue, and stops, so the next session
  starts with a fresh context.

Code:

- Pin exact versions in the pnpm catalog and upgrade only in dedicated units. oxlint moves
  only together with `@effect/tsgo`. ADR 0000 holds the stack choices and when to revisit them.
- No user text in URLs or query strings; loggers record URLs.
- `packages/core` and `packages/contract` stay isomorphic: `TextEncoder` and Web Crypto, never
  `Buffer` or `node:crypto`. `packages/core` exports by path (`@grifando/core/<module>`),
  with no barrel.
- No `zod` in code. Schemas for LLM JSON use `Schema.Finite` and `Schema.Int`, not
  `Schema.Number`; raw secret strings use `Schema.RedactedFromValue`.
- The Hono edge turns an Effect result into a response through one typed helper that requires
  a status for every tagged error, with one test per error.
- The Academy reads Evaluations: through Learning History's reads and the read-only views
  `evaluationsView`, `findingsView` and `suggestionsView` of `@grifando/db`. Code that writes
  both an Evaluation and Academy state composes them outside `apps/server/src/academy`, as
  `apps/server/src/practice/practice-writing.ts` does.
- The server bundle keeps npm packages external: every npm package that bundled workspace code
  imports is also a dependency of `apps/server`.
- Whatever starts the built server sets `NODE_ENV=production`, which serves the SPA, and
  `DATA_DIRECTORY` (local profile) or `DEPLOY_PROFILE=hosted` with `DATABASE_URL`. A hosted
  production server also needs `SESSION_SECRET` (ADR 0032), `IP_HASH_SALT`,
  `CLIENT_IP_HEADER` naming the header its proxy writes (ADR 0033), and `SITE_URL`, the public
  origin its `robots.txt`, `sitemap.xml` and link preview name (ADR 0037, ADR 0040).
- pnpm fails an install on a dependency build script nobody reviewed: list it in `allowBuilds`.
- Web tests import relatively: an `@/` alias would change `vite.config.ts`, which G11 records.

## Effect

Effect 4.1.2 runs in `apps/server` and in `packages/contract`, `core`, `db` and `env`. The web
app decodes with Effect Schema, the contract's above all, and runs no Effect service, layer or
runtime (ADR 0007).

- Errors are `Schema.TaggedError<X, { readonly brand: unique symbol }>()`, never
  `extends Error`.
- Services are `Context.Service` classes with a `static readonly layer`; the service id is the
  package name plus the path, for example `"@grifando/db/Database"`. A service class is
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
