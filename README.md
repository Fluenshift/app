# Fluenshift

One product from two: Prompt Evolution's reproducible evaluation of the English in real text, and Grifando's practice loop built from a learner's own mistakes. `app` is a working name.

The merge is in progress. The plan lives in [`docs/migration/`](./docs/migration/), the seam decisions in [`docs/adr/`](./docs/adr/), and the rules for agents in [`AGENTS.md`](./AGENTS.md).

## Requirements

Node 26.13.0 and pnpm 12.18.0. With [mise](https://mise.jdx.dev/), prefix the commands below with `mise exec node@26.13.0 pnpm@12.18.0 --`.

## Commands

```bash
pnpm install --frozen-lockfile   # install and patch TypeScript and oxlint with Effect diagnostics
pnpm verify                      # every local gate
pnpm test                        # unit and integration tests
pnpm test:e2e                    # Playwright journeys against the built server
pnpm dev                         # server and web in watch mode
pnpm build                       # server bundle and SPA build
```

## License

MIT.
