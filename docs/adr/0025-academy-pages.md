# 0025. The Academy's pages: a Hono read and an SPA route each

- Status: Accepted on 2026-11-20 by the session (ADR 0020).
- Phase 5e. Ledger rows: the six rows of Grifando's `pages.characterization.test.ts`
  (`academy-http`). The `/vocabulary` row becomes `port-changed` under this ADR.

## Context

- Grifando's pages `/`, `/today`, `/write`, `/vocabulary` and `/mistakes` read repositories in
  Next.js Server Components and hand the data to client components as props. The
  characterization at the baseline (`migration/characterization/grifando/files/src/app/`) pins
  those props and the text each page renders itself. This app is a Vite SPA that one Hono
  process serves (ADR 0000): no component reads the database.
- `/` is PE's Writing Desk, the root of the Evidence Lens layout (ADR 0009).
- Grifando's mistake card links to `/vocabulary?term=…&example=…&sessionId=…`, so a span the
  Learner wrote travels in a URL. ADR 0008 keeps Learner text out of URLs, because loggers
  record them.
- `/mistakes` filters by `window=30d` and `origin=pt`, and `/write` picks its Practice Prompt by
  `promptId` or `mode=daily`. These carry no Learner text, but G7 refuses any server route that
  reads them (`QUERY_KEYS` in `scripts/check-url-text.ts`).
- Grifando's Vitest runs in a node environment, without a DOM or Testing Library
  (`vitest.config.mts` and `package.json` at 74dbb9f). No test renders a client component, so
  the characterization of a page stops at the props it hands them.

## Decision

1. Each page read ports as one Hono `GET` route, which answers what the Server Component handed
   its client components, and one SPA route, which renders Grifando's components from that
   answer, decoded with a `packages/contract` schema. The screens call the routes through an
   Academy client beside the Evaluation client: over HTTP in `apps/web/src/api.ts`, in memory
   in the screen tests.
   - `/today`, and `/write` in its daily mode: `GET /api/daily-challenge`.
   - `/vocabulary`: `GET /api/vocabulary`, newest first.
   - `/mistakes`: `GET /api/mistakes` answers every Mistake Pattern with the state derived when
     it is read (due, fading, L1 Transfer) and the Mistake Category breakdowns of all time and
     of the last 30 days. The SPA applies `window` and `origin` from its own URL.
   - The Academy dashboard: `GET /api/academy/dashboard`.
   - The fixed banks, such as the technical Practice Prompts, are imported by the SPA from
     `packages/core`, so `/write?promptId=` resolves in the browser.

   No server route reads a filter or a prompt choice, so G7 is unchanged.
2. The Academy dashboard moves from Grifando's `/` to `/academy`; the Writing Desk keeps `/`.
   The other Academy pages keep Grifando's paths: `/today`, `/write`, `/vocabulary`,
   `/mistakes`, `/exercises`, `/interview`, `/technical` and `/explain-code`.
3. A prefill of the vocabulary form travels in the router's history state, never in the URL:
   "Save to vocabulary" opens `/vocabulary` with the term, the example and the source
   Evaluation in state. A shared link opens an empty form; a reload in the same tab keeps the
   prefill, since the browser keeps a history entry's state outside its URL (corrected on
   2026-11-20, #193).
4. Each page row targets the route test of its read in `apps/server` and the screen test of its
   route in `apps/web`, both under the row's title. The route test seeds PGlite and fixes the
   clock as the characterization does; the screen test renders the route on the in-memory
   client and asserts the text and the calls. `/write` reads nothing of its own (its daily mode
   is `/today`'s read), so its row targets the screen test only.
5. Grifando's client components port from their source without a characterization at the
   baseline, which cannot render them and cannot change. Each screen test asserts the copy, the
   roles and the API calls the source shows. A difference found later is a bug against the
   source, fixed in the target.

## Consequences

- The `/vocabulary` row becomes `port-changed`; its targets say "from the history state" where
  the source says "from the query".
- The `/` row (`adr:0004`) is ported at `/academy`.
- A link to an Academy page that names a filter or a Practice Prompt still works, since those
  stay in the URL; a link that would carry Learner text does not exist.
- The web app depends on `packages/core`, which is isomorphic.

## Alternatives

- Add `window`, `origin`, `promptId` and `mode` to G7's query keys and filter on the server:
  smaller answers, but a gate change for values the SPA can apply alone.
- Keep the prefill in the URL: shareable, but it puts Learner text in a URL.
- Render the Academy dashboard at `/` and move the Writing Desk: breaks ADR 0009.
