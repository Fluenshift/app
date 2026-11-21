# 0043. The end-to-end pause ends; the rows that check the interface drop

- Status: Accepted on 2026-11-21, at the request of Jhefferson in a Claude Code session (#318).
- Amends `AGENTS.md` (Rules, the end-to-end pause), `MIGRATION_PROTOCOL.md` (Phase 4f, Phase 6
  item 4, G6) and ADR 0037's consequence on the hosted Docker smoke. Ledger rows: the ten of
  decision 2 become `drop` under this ADR.

## Context

- On 2026-11-15 the owners paused the end-to-end tests: no new Playwright journey, Vite dev-proxy
  case or Docker smoke check, and their rows stayed open. On 2026-11-21 eighteen rows were open
  for that reason alone, and parity sign-off (Phase 7, item 1) needs every row terminal.
- On 2026-11-21 Jhefferson ran the product, ended the pause, and wrote that the interface will
  probably change drastically, so anything about it can be ignored.
- Ten of the open rows check the interface: they drive or inspect pages in a browser, or the web
  app's development server. Eight check the server, its container and its data, with no browser.

## Decision

1. The pause ends. An end-to-end check of the server, its container or its data is ported like
   any other row.
2. The ten rows that check the interface drop:
   - `pe:test:e2e/mvp.spec.ts::complete retained-evidence journey`, a browser journey through the
     Writing Desk, History and Progress pages. Route tests pin the server calls it crosses.
   - The four `pe:test:apps/server/src/test/dev-proxy.test.ts::real development proxy same-origin
     access` rows, which run the web app's development server in front of the server: that
     server is part of the interface. The guard's refusals they repeat are pinned in process
     (#47), and G11 keeps the proxy's `changeOrigin: false` in `apps/web/vite.config.ts`, which
     the same-origin case pinned.
   - `grifando:deploy-smoke:02` to `06`, the checks Grifando made by hand in a browser after a
     deploy: the key notice on `/write`, the key test on `/settings`, a written text reaching its
     corrected page, the exercises, and "Delete my data". Route and screen tests pin the calls
     behind them.
3. The eight others port: `pe:docker-smoke:L464`, `L471`, `L495`, `L525` and `L532` in the local
   Docker smoke, and `grifando:deploy-smoke:01`, `07` and `08` (the session cookie, the CSP
   header, robots and sitemap) in a Docker smoke of the hosted profile.
4. The Playwright journeys already in `e2e/` keep running until the pages they drive change.

## Consequences

- Sign-off waits for the eight rows of decision 3, then for the rest of Phase 7.
- Screen tests and journeys that are ledger targets stay under the porting rules until the
  migration retires; a change to the interface before then follows those rules.

## Alternatives

- Port the browser rows too: they would pin pages the owners expect to replace.
- Drop all eighteen: the eight rows of decision 3 check the built container and its data, which
  no in-process test reaches.
