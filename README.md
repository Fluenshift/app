# Fluenshift

One product from two: Prompt Evolution's reproducible evaluation of the English in real text, and Grifando's practice loop built from a learner's own mistakes. `app` is a working name.

The merge is in progress. The plan lives in [`docs/migration/`](./docs/migration/), the seam decisions in [`docs/adr/`](./docs/adr/), and the rules for agents in [`AGENTS.md`](./AGENTS.md).

## Requirements

Node 26.13.0 and pnpm 12.18.0, which `mise.toml` pins: with [mise](https://mise.jdx.dev/), run `mise trust` once in the clone.

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
pnpm docker:smoke                # build and check the image of the local profile (gate G6)
```

## Local profile in Docker

The image runs one non-root process that serves the API and the web app. Compose publishes it on `127.0.0.1:3001` only, runs it as the invoking user and keeps its data in `./.data`.

```bash
pnpm docker:up                   # build and start it
pnpm docker:logs                 # follow its logs
pnpm docker:down                 # stop and remove the container; the data stays in ./.data
```

### Importing PE's local history

Prompt Evolution's local Evaluations move into the local profile once, as Rubric Version 1 (ADR 0018). Stop PE and the container, build, then run the importer from `apps/server` on PE's `local.db`, which PE's Docker setup kept in `.data/` of its clone. Run it as a dry run first:

```bash
pnpm docker:down && pnpm build && cd apps/server
DATA_DIRECTORY=../../.data/pglite node dist/import-pe.mjs --dry-run <path to PE's local.db>
DATA_DIRECTORY=../../.data/pglite node dist/import-pe.mjs <path to PE's local.db>
```

Accept the import only when both runs print the same counts. The importer never writes to PE's file, imports nothing when a row does not fit the product, and refuses a file it has imported before.

## License

MIT.
