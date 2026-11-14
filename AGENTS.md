# Agent notes

This repository merges two products into one on a new stack: Prompt Evolution (PE), which
evaluates the English of real text, and Grifando, which turns a learner's mistakes into
practice. The migration is in progress and no human reviews code: the gates are the reviewer.

Read these before any work, in this order:

1. `docs/migration/HANDOFF.md`: repositories and setup.
2. `docs/migration/PRE_MIGRATION.md`: approved stack and product direction.
3. `docs/migration/MIGRATION_PROTOCOL.md`: phases, the work unit cycle, gates.
4. `docs/migration/README.md`: the inventory, the ledger, labels, the G12 verdict format.
5. `docs/adr/`: seam decisions. A **Proposed** ADR decides nothing yet.

This file is the short form of their rules. When they disagree with it, they win.

## Commands

Node 26.13.0 and pnpm 12.18.0. Where they are not on `PATH`, prefix commands with
`mise exec node@26.13.0 pnpm@12.18.0 --`.

| Command | What it does |
| --- | --- |
| `pnpm install --frozen-lockfile` | Install; also patches TypeScript and oxlint with the Effect diagnostics. |
| `pnpm verify` | Every local gate: format, gate integrity, lint, Effect lint, types, Effect diagnostics, tests, build. |
| `pnpm format` / `pnpm format:fix` | Check or apply oxfmt. |
| `pnpm lint` / `pnpm lint:effect` | oxlint, and the type-aware Effect rules. Warnings fail. |
| `pnpm check-types` / `pnpm check:effect` | `tsc` per workspace, and the Effect diagnostics. |
| `pnpm test` | Vitest in every workspace. |
| `pnpm test:e2e` | Build the server, then run the Playwright journeys against it. |
| `pnpm build` | Server bundle and SPA build. |
| `pnpm check:gates` | Gate integrity (G11): every lint, TypeScript, CI and test setting is at least as strict as `gates/baseline.json`, and no file gains a suppression comment. Only the coordinator records a new baseline, with `node scripts/check-gates.ts --write`. |

Migration scripts run on plain Node, with no dependencies:
`node scripts/migration/<script>.ts` (see `docs/migration/BASELINES.md` and `README.md`).

## Layout

| Path | Contents |
| --- | --- |
| `apps/server` | Hono on `@hono/node-server`, with Effect services. One process serves the API and the SPA. |
| `apps/web` | Vite, React, TanStack Router. `src/api.ts` is the only module that calls the server. |
| `packages/contract` | Effect Schema for every API request and response. Isomorphic. |
| `packages/core` | The pure domain. Isomorphic: no Node built-ins, no `Buffer`. |
| `packages/db` | Drizzle inside the Effect `Database` service; PGlite for tests and local mode. |
| `packages/env` | Effect `Config`. The only place that may read the environment. |
| `packages/ui` | Shared UI components. |
| `packages/config` | Shared TypeScript configuration, including the Effect diagnostic severities. |
| `e2e` | Playwright journeys against the built process. |
| `docs/migration`, `migration/` | Baselines, inventory, ledger, characterization tests. |

## Work units

Work units and decision requests are GitHub Issues; state lives in labels, never in files.

1. Take only a unit assigned to you: an issue labeled `ready-for-agent` that lists its ledger
   rows, source files at the pinned commits and target paths. Swap the label to `in-progress`,
   add `implementer:<vendor>`, and branch `wu/<issue>-<slug>` from `main` in a fresh worktree.
2. Read the ledger rows, then the source tests, then the source code, then the ADRs they cite.
   If anything is ambiguous, ask on the issue, label it `needs-info`, and stop.
3. Commit 1 holds tests only: port each source test, title verbatim, changing only the
   mechanics in the mapping table of `docs/migration/README.md`, with typed stubs so they
   compile. They must fail on assertions, not on imports.
4. Later commits port the code into the target idioms until the tests and `pnpm verify` pass.
   Reuse the baseline code wherever it fits; keep algorithms, constants, orderings, limits and
   messages identical; add no behavior.
5. For class A and B rows, break one condition or constant per ported module, confirm a ported
   test fails, revert, and list the mutations in the PR.
6. Write the ledger targets as `file::full title`, open one PR that closes the issue, label it
   `implementer:<vendor>`, and move the issue to `in-review`.
7. A verifier from the other vendor posts the G12 verdict. Never push to a branch you verify.
8. Stop rule: after two failed attempts at the same gate failure, or whenever green would need
   a changed expected value, gate or disposition, post the failing output on the issue, label
   it `needs-info`, and stop.

## Rules

Migration:

1. Baselines are read-only. Read and run sources only at the pinned commits, through
   `scripts/migration/baselines.ts`, in disposable worktrees outside this working tree. Never
   push to, tag, open issues or PRs in, or change settings of `Fluenshift/prompt-evolution` or
   `Fluenshift/grifando`. Never change organization or ruleset settings. Use only the token
   the session started with.
2. Precedence: baseline tests, then baseline code, then docs. An accepted ADR overrides all
   three for its rows. When sources disagree, file a decision request instead of choosing.
3. Tests come first. In a `port` row never change an expected value, delete an assertion,
   weaken a matcher, rename the title, or add `skip`, `only` or `todo`.
4. Port behavior, not architecture.
5. Behavior no test covers gets a characterization test against the baseline before it is
   ported.
6. Build nothing outside the ledger. Both systems' out-of-scope lists stay out of scope unless
   an ADR adds an item.
7. For an open decision, implement neither side; its rows stay `pending-decision`.
8. Use the `CONTEXT.md` vocabulary in code, tests and UI, never the synonyms it forbids.
9. The Judge uses one pinned model per Rubric Version, with no retry and no silent fallback.
   The Trainer may fall back, only on overload. Both record the model that answered.
10. Never call a paid model. Tests never need real keys, and CI has none.
11. Never log or persist credentials, hidden reasoning or raw provider bodies, and never log
    Writing Sample text at info level. BYOK keys travel only in request headers.
12. Shared files belong to the coordinator: `packages/db` migrations (generated with
    drizzle-kit, never hand-written, one in flight at a time), the `packages/contract` index,
    CI workflows, `gates/baseline.json`, `docs/migration/baselines.json` and the ledger schema.
    Implementers only add files for their own slice.
13. One unit per branch and PR: no drive-by refactors, dependency bumps or formatting churn.
14. Never weaken a gate to get green: no lowered lint or Effect severity, no new suppression
    comment, no removed check. If a gate seems wrong, file a decision request.
15. A verifier never edits the work it verifies and never belongs to the vendor that
    implemented it. Implementer and verifier are recorded in labels and in the verdict comment,
    not in commit messages.
16. Agents never post owner decisions or acceptance. Ask on the issue and wait for an owner.

Code:

- Pin exact versions in the pnpm catalog and upgrade only in dedicated units. oxlint moves
  only together with `@effect/tsgo`.
- No user text in URLs or query strings; loggers record URLs.
- `packages/core` and `packages/contract` stay isomorphic: `TextEncoder` and Web Crypto, never
  `Buffer` or `node:crypto`.
- No `zod` in code. Schemas for LLM JSON use `Schema.Finite` and `Schema.Int`, not
  `Schema.Number`; raw secret strings use `Schema.RedactedFromValue`.
- The Hono edge turns an Effect result into a response through one typed helper that requires
  a status for every tagged error, with one test per error.

## Effect

Effect 4.1.2 runs in `apps/server` and in `packages/contract`, `core`, `db` and `env`. The web
app uses only the schemas of `packages/contract`.

- Read `node_modules/effect/AGENTS.md` and `node_modules/effect/ai-docs/` first: they match the
  installed version. The effect-docs MCP mixes Effect 3 and release-candidate pages.
- Errors are `Schema.TaggedError`, never `extends Error`.
- Services are `Context.Service` classes with a `static readonly layer`; the service id is the
  package name plus the path, for example `"@fluenshift/db/Database"`.
- Functions that return an Effect are named with `Effect.fn("Service.method")`.
- Configuration comes from `Config` in `packages/env`, never `process.env`.
- Drizzle is used only inside the `Database` service.
- Config constructors are capitalized in 4.1.2 (`Config.NonEmptyString`, `Config.Port`), and a
  service class is itself an Effect: `yield* ServerConfig`.
- Unstable Effect APIs fail type checking unless listed in `allowedUnstableApis` in
  `packages/config/tsconfig.base.json`. Adding one is a coordinator change.
