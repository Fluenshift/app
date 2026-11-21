# 0000. The approved stack

- Status: recorded from `PRE_MIGRATION.md` of 2026-11-10, which states that both owners approved
  this stack. ADR 0019 moved the text here when it deleted that file.
- No ledger row cites it.

## Context

All code is written by an agent, and no human reads or reviews it. The compiler, the linters,
the diagnostics and the tests are the reviewer. Each choice was weighed by how much it turns an
agent's mistake into a build failure. Human learning curve was not a cost.

## Decision

Exact versions live in the catalog of `pnpm-workspace.yaml`. They change only in dedicated
units.

| Layer | Choice |
| --- | --- |
| Runtime | Node LTS |
| Package manager | pnpm with workspaces, a catalog, `allowBuilds` and a pinned `packageManager` |
| Monorepo | Turborepo |
| Language | TypeScript native with `@effect/tsgo`: the `tsc` patch and its diagnostics, with severities raised to error |
| Lint and format | oxlint (type-aware, Effect preset), oxlint-tsgolint and oxfmt. No ESLint: typescript-eslint requires TypeScript below 6.1 |
| Backend | Hono on `@hono/node-server`; one process serves the API and the static SPA |
| Server logic | Effect (services, Layer, Config, Redacted, tagged errors) with `@effect/platform-node` |
| Validation and contract | Effect Schema everywhere, in a shared contract package; at the edge each route checks its body with its contract schema and declares it to the typed client (ADR 0042 replaced `@hono/standard-validator`). No Zod in code (it may remain as an AI SDK peer) |
| Front end | SPA: Vite, React and TanStack Router; the Hono `hc` client in one API module; landing page and OG image static at build |
| UI | Tailwind, shadcn, Base UI and lucide |
| Persistence | Postgres with Drizzle ORM and drizzle-kit inside an Effect service; PGlite for tests and local mode (ADR 0017) |
| AI | AI SDK (`ai`, `@ai-sdk/google`, `@ai-sdk/anthropic`, `@openrouter/ai-sdk-provider`) inside the Effect services `Judge` and `Trainer` (ADR 0012; ADR 0042 dropped the unused `@ai-sdk/openai`) |
| Tests | Vitest with `@effect/vitest`; Playwright for E2E |
| Container | A slim Node image pinned by digest, single process, non-root |
| Git hooks | husky |

## Consequences

- Versions are pinned exactly: Effect 4.1.2 marks `http`, `http-api`, `ai` and `sql` as
  unstable, the AI SDK had three majors in eleven months, and oxlint moves only together with
  `@effect/tsgo`.
- Schemas for LLM JSON use `Schema.Finite` and `Schema.Int`: `Schema.Number` emits `anyOf` with
  `NaN` and `Infinity`.

## Alternatives, and when to revisit them

- **Effect HttpApi as the backend**: the first pick of the independent evaluation, because an
  undeclared error fails compilation at the edge. Jhefferson chose Hono. Revisit if bugs in the
  mapping from Effect to HTTP recur.
- **Bun 1.4**: rejected mainly on maturity. It is the first release after the rewrite from Zig
  to Rust, and not fully compatible with Node.js. Reversible through the Effect platform layer.
- **Elysia**: Bun-only, its npm `latest` was a release candidate of a complete rewrite, and
  Effect errors need glue per route.
- **Next.js and TanStack Start**: implicit SSR, RSC and prerender semantics that types do not
  check. Revisit Start if SEO for dynamic public pages becomes central.
- **Prisma**: needs `prisma generate`, and its npm `latest` was a release candidate.
- **Effect AI native**: no Gemini provider for Effect 4. Switch from the AI SDK if Gemini leaves
  the product.
- **Drizzle 1.0**: still a release candidate, and it ships native Effect modules. Adopt it when
  stable.
