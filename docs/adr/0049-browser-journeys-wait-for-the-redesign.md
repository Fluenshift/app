# 0049. The browser journeys (G5) wait until the interface settles

- Status: Accepted on 2026-11-28. Jhefferson judged, in a session, that the Playwright journeys
  do not pay off now nor for a good while, and the session agreed on the numbers below (#373).
- Supersedes ADR 0043, decision 4, and the Playwright line of ADR 0000's stack. Retires gate G5.

## Context

- G5 held three Playwright tests in `e2e/`, against the built process in the local profile:
  1. The health check answers `{ "status": "ok" }`.
  2. A direct browser route, `/evaluations/evaluation-1`, answers the SPA's HTML.
  3. Chromium opens `/` and sees the heading "Writing Desk", with `cache-control: no-cache`.
- The first two are plain HTTP. `apps/server/src/app.test.ts` already pins the SPA fallback with
  `no-cache` and the immutable assets, and the Docker smoke (G6) starts the built image, fetches
  `/` and every browser asset, and checks the hosted profile's headers. The build itself is G4,
  in the static checks.
- The third is the only check in a real browser, and it asserts a heading the redesign (#333)
  replaces, in a language ADR 0048 replaces. ADR 0043 already stopped new journeys for the
  current pages.
- The CI job took about a minute in parallel with the others, so it never lengthened a run, but
  it downloaded Chromium every time, once hung for over nine minutes (PR #157), and kept a
  dependency, a configuration and their G11 records alive for one assertion.
- Jhefferson's view: browser journeys are costly and fragile while the interface changes this
  much, and the failures they would catch are ones he sees himself when he uses the product.

## Decision

1. G5 retires until the interface settles: the journeys, `playwright.config.ts`, the
   `@playwright/test` dependency, the `test:e2e` script and the CI job go.
2. The pages are covered by screen tests (Vitest with Testing Library), and the server, its
   container and its data by route tests and the Docker smoke, as before.
3. The gate checkers keep recognizing a Playwright configuration, so the journeys can come back
   without changing them.
4. Browser journeys return under a new ADR when the redesign's main screens are built and stable,
   or before the hosted service goes live, whichever comes first: two or three journeys of the
   main path (write a text and read its Evaluation; answer an Exercise), not one per page.

## Consequences

- No gate opens the built bundle in a browser. A change that builds but leaves the page blank,
  for example an error when a module first runs, merges with every check green, and the owners
  find it when they open the product. The hosted service is not live yet, so no visitor meets it.
- The specs' test plans for Text Kinds and Progress charts name screen tests where they named
  Playwright journeys.
- Prototype screenshots (#333) can still use Playwright outside the product, through `pnpm dlx`
  or the prototype branch's own install.

## Alternatives

- Keep G5 as it is: one assertion about a heading the redesign removes, for a dependency, a
  configuration and a browser download on every run.
- Rewrite the journey against the redesign as each screen lands: it would change with every
  round of #333, which is the fragility Jhefferson named.
- Load the built bundle in jsdom to catch a blank page without a browser: it would need the
  built assets, a fake browser environment and its own maintenance, for a failure the owners see
  at once.
