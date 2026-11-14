# PRE_MIGRATION — Prompt Evolution + Grifando

Handoff for the merge of the two projects into one product. Read this before any merge
work. Written 2026-11-10. The stack below is approved by both owners (Jhefferson and Levy).

## Sources

All three repos live in one GitHub organization; see `HANDOFF.md` § Topology.

| System | Repository | Owner | Notes |
| --- | --- | --- | --- |
| Prompt Evolution (PE) | `<org>/prompt-evolution`, created at setup | Jhefferson | Local-only app. Before setup it had no remote and 3 commits, and most of the MVP was uncommitted (`apps/server/src/evaluation/` had 0 tracked files on 2026-11-09). Setup commits the MVP, pushes it and tags `parity-baseline`; that commit is the reference. |
| Grifando | `<org>/grifando`, transferred from `levyrodrigues23/grifando` | Levy | Live at `grifando.vercel.app` (Vercel Hobby and Neon), MIT. Tagged `parity-baseline`. Its deploy and CI after the transfer are deferred (`HANDOFF.md` § Deferred). |
| Merged product | `<org>/<product>` (URL in `HANDOFF.md`) | Both owners, as organization Owners | Imports no source history; pins both baselines by commit SHA in `docs/migration/baselines.json`. |

Specs to read: PE `CONTEXT.md`, `docs/product/{REQUIREMENTS,RUBRIC,DATA-POLICY}.md`,
`docs/adr/`; Grifando `SPEC.md`, `PRODUCT.md`, `DESIGN.md`, `CLAUDE.md`.

## Development model

Full vibecode. All code is written by Claude Code or Codex; no human reads or reviews it.
The compiler, linters, diagnostics and tests are the reviewer. Weigh every choice by how
much it turns agent mistakes into build failures. Human learning curve is not a cost.

## Product direction

One product, two axes:

- **Evaluation** (from PE): the learner submits real text — mostly prompts for AI agents,
  also PRs and issues — and gets a reproducible assessment of its English. Works alone.
- **Academy** (from Grifando), optional: mistake patterns, generated exercises, deterministic
  grading, spaced review, Elo, daily session, interview, vocabulary.

Seam rules from the 2026-11-09 compatibility analysis. Confirm each with both owners before
writing them into requirements:

- One-way dependency: the Academy reads Findings and never writes Evaluation, Finding,
  score, band or Progress Insight.
- Fixed judge per Rubric Version: one pinned model, no retry, no silent fallback, records
  the model that answered. The Academy trainer may use any provider with fallback, and also
  records the model that answered.
- Writing Sample carries its origin (work or practice); practice stays out of Finding Rate
  by default.
- "Correct but unnatural" leaves score, corrected text and Finding Rate; it becomes a
  separate per-span channel the Academy may consume. Needs a new Rubric Version.
- Layered taxonomy: PE's 9 Error Categories are the measured level; Grifando's finer
  categories and `patternKey` are a pedagogical sublevel; `LITERAL_TRANSLATION` becomes the
  `l1Transfer` flag.
- Academy state is derivable from retained Findings plus exercise attempts, so deleting an
  Evaluation cascades.
- Evaluation shows values and evidence, never "improved". The Academy talks about practice
  state ("mastered in exercises") with real-text evidence beside it.

Still open: deploy model (public hosted, self-host Docker, or data in the browser); judge
provider (OpenRouter vs Gemini BYOK — the Gemini free tier may train on submitted text);
analytics (Grifando uses Vercel Analytics, PE forbids remote telemetry); whether a mistake
reappearing in real text demotes mastery; Academy state across Rubric Versions; practice
offered vs imposed (Grifando SPEC §3); the product name; what Grifando may change before the
cutover (`HANDOFF.md` step 3). Decided at setup: the product and PE are both MIT, and one
organization holds both source repos and the product repo (`HANDOFF.md` § Topology). None of
these changes the stack, only configuration. Live calibration is deferred until after parity
(see `MIGRATION_PROTOCOL.md`).

## Approved stack

Pin exact versions; versions verified on npm on 2026-11-09, and pinned to exact patch
versions on 2026-11-13. Phase 2 puts every package, including the four AI SDK providers, in
the pnpm catalog at the exact version below, commits the lockfile, and pins the container
image by patch version and digest.

| Layer | Choice | Version |
| --- | --- | --- |
| Runtime | Node LTS (fallback: Node 24 LTS) | 26.13.0 |
| Package manager | pnpm with workspaces, catalog, `allowBuilds`, `packageManager` pinned | 12.18.0 |
| Monorepo | Turborepo | 2.11.11 |
| Language | TypeScript native + `@effect/tsgo` (tsc patch and diagnostics in CI, severities raised to error) | 7.0.2 / 0.67.5 |
| Lint and format | oxlint (type-aware, Effect preset) + oxlint-tsgolint + oxfmt. No ESLint: typescript-eslint requires TS < 6.1 | 1.92.0 / 7.0.2006 / 0.78.0 |
| Backend | Hono + `@hono/node-server`; one process serves API and static SPA | 4.13.18 / 2.1.8 |
| Server logic | Effect (services, Layer, Config, Redacted, tagged errors) + `@effect/platform-node` | 4.1.2 |
| Validation and contract | Effect Schema everywhere, in a shared contract package; `@hono/standard-validator` at the edge. No Zod in code (it may remain as an AI SDK peer) | effect 4.1.2 / 0.4.1 |
| Front-end | SPA: Vite + React + TanStack Router; Hono `hc` client in one API module; landing and OG image static at build | 8.3.8 / 19.3.1 / 1.170.46 |
| UI | Tailwind + shadcn + Base UI (`@base-ui/react`) + lucide (`lucide-react`) | 4.3.5 / 4.23.0 / 1.9.0 / 1.72.0 |
| Persistence | Postgres + Drizzle ORM + drizzle-kit (`node-postgres`, pg) inside an Effect service; PGlite for tests and local mode | 0.45.4 / 0.31.11 / 8.23.1 / 0.5.16 |
| AI | AI SDK (`ai`, `@ai-sdk/google`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@openrouter/ai-sdk-provider`) inside Effect services `Judge` and `Trainer` | 7.0.172 / 4.0.120 / 4.0.104 / 4.0.117 / 3.1.0 |
| Tests | Vitest + `@effect/vitest`; Playwright for E2E | 5.1.0 / 4.1.2 / 1.65.0 |
| Container | `node:26.13.0-slim`, pinned by digest, single process, non-root. Docker mandatory; mise optional | 26.13.0 |
| Git hooks | husky | 9.1.7 |

## Alternatives considered

- **Effect HttpApi as backend**: the independent evaluator's first pick, because an
  undeclared error fails compilation at the edge (TS2322, reproduced). Jhefferson chose Hono.
  Revisit if Effect-to-HTTP mapping bugs recur.
- **Bun 1.4**: rejected mainly on maturity — 1.4 (2026-08-20) is the first Zig-to-Rust
  rewrite and "not 100% compatible with Node.js yet". Reversible through the Effect platform
  layer. Tested: `bun --bun vitest run` works with `@effect/vitest` and `bun:sqlite`.
- **Elysia**: Bun-only (Node adapter idle since 2026-02-17); npm `latest` is the 2.0 RC, a
  complete rewrite; Effect errors need per-route glue.
- **Next.js / TanStack Start**: implicit SSR/RSC/prerender semantics that types do not check.
  TanStack Start 1.169 is its first stable release. Revisit Start if SEO for dynamic public
  pages becomes central.
- **Prisma**: needs `prisma generate`; npm `latest` is `8.0.0-rc.33`.
- **Effect AI native**: no Effect v4 Gemini provider (`@effect/ai-google` is 0.16, Effect 3).
  Switch from AI SDK if Gemini leaves the product.
- **Drizzle 1.0**: still RC (`1.0.0-rc.5`), ships native Effect modules. Adopt when stable;
  `@effect/sql-drizzle` supports Effect 3 only.

## Rules for the new repo's AGENTS.md / CLAUDE.md

- Pin exact versions and upgrade deliberately. Effect 4.1.2 marks `http`, `http-api`, `ai`
  and `sql` as `@stability unstable`; AI SDK had three majors in eleven months; oxlint moves
  only together with `@effect/tsgo` (supported range 1.88–1.92).
- Hono edge: one typed helper turns an Effect result into a Hono response and requires a
  status for every tagged error (`satisfies Record<ErrorTag, Status>`, like PE's
  `FAILURE_STATUS`). Every route uses it; one test per error.
- Never lower lint or `effect-tsgo` severities to make CI pass.
- Effect v4 reference: `node_modules/effect/AGENTS.md` and `ai-docs`. The effect-docs MCP
  mixes Effect 3 and RC pages.
- No user text in URLs or query strings; loggers record URLs. PE's Progress drill-down
  currently sends `originalText` and `correction` as query parameters — fix in the port.
- `packages/core` stays isomorphic: no `Buffer` or `node:crypto` (PE uses them in
  `assessment-localization.ts` and `writing-evaluation.ts`; use `TextEncoder` and Web Crypto).
- LLM JSON schemas: use `Schema.Finite` / `Schema.Int`, not `Schema.Number`, which emits
  `anyOf` with `NaN` / `Infinity`. Use `Schema.RedactedFromValue` for raw secret strings.

## Known defects to fix by design

- Grifando #77: fallback records the primary `modelId` — Judge and Trainer record the model
  that answered.
- Grifando #78: highlights located with `indexOf` — locate spans by offset, validated
  against the text, re-anchored only when unique (PE's `assessment-localization.ts`).

## Migration strategy

Defined in [`MIGRATION_PROTOCOL.md`](./MIGRATION_PROTOCOL.md), which supersedes the earlier
sketch that stood here. In short, it is a ledger-driven, test-first port into a new neutral
repo, with PE as the tooling template. It adds the following:
- frozen baselines;
- a machine-generated inventory and a CI-checked parity ledger;
- characterization tests for untested behavior;
- ADRs only at the seams;
- red-green, assertion-audit and gate-integrity checks;
- cross-vendor verification (Claude Code and Codex check each other's units).

The first steps are owner actions, listed in `HANDOFF.md`: create the organization, move
both source repos into it, tag both baselines, and create the product repo.
