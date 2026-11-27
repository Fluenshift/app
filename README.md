# Grifando

One product from two: Prompt Evolution's reproducible evaluation of the English in real text, and old Grifando's practice loop built from a learner's own mistakes, whose name it took (ADR 0045).

The merge is done (ADR 0044): its plan, ledger and characterization tests stay in git history, at 8a379e2. The decisions live in [`docs/adr/`](./docs/adr/), the product documents in [`docs/product/`](./docs/product/), and the rules for agents in [`AGENTS.md`](./AGENTS.md).

## Requirements

Node 26.13.0 and pnpm 12.18.0, which `mise.toml` pins: with [mise](https://mise.jdx.dev/), run `mise trust` once in the clone.

One `OPENROUTER_API_KEY` runs both the Judge and the Trainer.

## Commands

```bash
pnpm install --frozen-lockfile   # install and patch TypeScript and oxlint with Effect diagnostics
pnpm verify                      # static checks, the tests that need no Docker, and the build
pnpm test                        # unit and integration tests
pnpm test:e2e                    # Playwright journeys against the built server and web app
pnpm test:postgres               # the Database service against Postgres 17: set DEPLOY_PROFILE=hosted and DATABASE_URL
pnpm db:generate                 # write the next migration from the Drizzle schema
pnpm dev                         # Vite for the web app; it proxies /api to a server started on port 3000
pnpm build                       # server bundle and SPA build
pnpm docker:smoke                # build and check the image in the local and hosted profiles (gate G6)
```

## Local profile in Docker

The image runs one non-root process that serves the API and the web app. Compose publishes it on `127.0.0.1:3001` only, runs it as the invoking user and keeps its data in `./.data`.

```bash
pnpm docker:up                   # build and start it
pnpm docker:logs                 # follow its logs
pnpm docker:down                 # stop and remove the container; the data stays in ./.data
```

## License

Source-available under the [PolyForm Noncommercial License 1.0.0](./LICENSE) (ADR 0047): anyone may read, run, change and share Grifando for a noncommercial purpose. Commercial use needs a license from Fluenshift.
