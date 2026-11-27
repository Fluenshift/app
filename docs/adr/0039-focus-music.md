# 0039. Focus Music sits in the header of both profiles, in a sandboxed frame

- Status: Accepted on 2026-11-21 by the session (ADR 0020), with the Phase 6 Focus Music unit
  (#252). Decision 1 amended the same day after the pre-cutover review (#267), to say where the
  player sits: the code kept Grifando's placement, which the first wording did not describe.
  Superseded by ADR 0046, which cuts Focus Music.
- Phase 6, item 1 (`docs/migration/MIGRATION_PROTOCOL.md`). Grifando's
  `src/components/layout/FocusMusic.tsx` (74dbb9f) has no test at the baseline and ports from
  source (ADR 0025, decision 5); the rows of its link parsers, in `academy-web.json`, were
  ported by #129. Grifando issues #6 and #22 are informative rows.

## Context

- Grifando rendered Focus Music in `SiteHeader`, in its root layout: a button that opens a
  popover with a Spotify or YouTube player, the saved playlists and a form for a new link. Its
  issue #22 kept the player mounted when the popover closes and across client-side navigation,
  so the music never stops.
- Fluenshift's shell has two navigations. The primary navigation sits in the root route, on every
  screen of both products. The Academy navigation sits inside each Academy screen's `PageShell`,
  which a change of route mounts again.
- Grifando's frame had no `sandbox` attribute. Lint (G2) refuses an iframe without one
  (`react/iframe-missing-sandbox`), and refuses `allow-scripts` beside `allow-same-origin`,
  because a frame on the page's own origin with both can remove its own sandbox. Spotify's and
  YouTube's players are on their own origins.
- Checked on 2026-11-21 in Chrome, outside the repository: with `allow-scripts` and without
  `allow-same-origin`, Spotify's player renders but never plays, and YouTube's renders black.
  With both, beside the popup, presentation and storage access tokens, each plays as it does
  without a sandbox.
- The hosted CSP already allows both players' origins in `frame-src` (ADR 0032). The local
  profile sends no CSP.
- `docs/product/DATA-POLICY.md` lists what leaves the machine in each Deploy Profile, and
  `docs/product/ASSET-LICENSES.md` said the bundle makes no third-party runtime request.

## Decision

1. Focus Music sits in the root route's header in both Deploy Profiles, beside the primary
   navigation and outside it, as Grifando's sat in its site header: on the brand's row on narrow
   screens, and after the navigation from the `sm` width up. The root route keeps it mounted, so closing it or changing pages never stops the music, as Grifando #22 required. It
   loads no player until the Learner first opens it.
2. It ports Grifando's component as it was: its copy and roles, Deep Focus as the first
   playlist, the storage keys `focus-music:last-link` and `focus-music:playlists`, and a player
   that still works for the visit when the browser blocks storage.
3. The player's frame carries `sandbox="allow-popups allow-popups-to-escape-sandbox
   allow-presentation allow-same-origin allow-scripts allow-storage-access-by-user-activation"`:
   the narrowest set both players play in, keeping Spotify's full tracks for a Learner logged in
   to Spotify and the players' links to their own sites. The frame still cannot navigate the
   page, submit forms, open dialogs or download files.
4. Lint turns `react/iframe-missing-sandbox` off for `apps/web/src/features/music/focus-music.tsx`
   alone, and G11 records that override. The screen test, `-focus-music.test.tsx`, pins the
   sandbox in its place.
5. `DATA-POLICY.md` states, for both profiles, that opening Focus Music connects the browser to
   Spotify or YouTube and that its playlists stay in the browser's storage. `ASSET-LICENSES.md`
   names the same exception.

## Consequences

- A Learner who never opens Focus Music sends no request to Spotify or YouTube.
- Every other iframe still needs a sandbox the rule accepts.
- A new music provider needs its origin in the hosted CSP's `frame-src`, a parser in
  `music-link.ts`, and a check that its player plays in this sandbox.
- The hosted privacy page keeps Grifando's copy, which never named Focus Music; the data policy
  states it.

## Alternatives

- The Academy navigation: each Academy screen mounts it again, so changing pages would stop the
  music, which Grifando #22 refused.
- The hosted profile only, since Grifando had no local profile: the Academy runs in both, and
  Focus Music loads nothing until the Learner opens it.
- A sandbox without `allow-same-origin`, which the rule accepts: neither player plays.
- Grifando's frame without a sandbox: it needs the same lint exception, and the frame could
  navigate the page.
- The sandbox in a constant, which the rule cannot read: lint would pass, but the exception would
  stay out of the lint configuration and out of G11's record.
