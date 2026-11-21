# 0037. The hosted profile answers robots.txt and sitemap.xml at the origin SITE_URL names

- Status: Accepted on 2026-11-20 by the session (ADR 0020), with the Phase 6 robots and sitemap
  unit (#243).
- Phase 6. Ledger rows in `hosted.json`: `grifando:test:src/app/sitemap.test.ts::getSiteUrl >
  prefers NEXT_PUBLIC_SITE_URL, then the Vercel production host, then localhost` and the
  characterizations of `robots()` and of the proxy matcher become `port-changed` under this ADR;
  the sitemap row stays `port-changed` under ADR 0003.

## Context

- Next.js generated Grifando's `robots.txt` and `sitemap.xml` from `src/app/robots.ts` and
  `src/app/sitemap.ts` (74dbb9f). The sitemap lists `/`, `/technical`, `/privacy` and
  `/settings`; the robots rules allow every crawler everywhere but `/api/`, and name the sitemap.
  Both use `getSiteUrl` (`src/lib/siteUrl.ts`): `NEXT_PUBLIC_SITE_URL` without its trailing
  slashes, else `https://` and Vercel's production host, else `http://localhost:3000`.
- Grifando's proxy, which minted the session cookie, skipped both files through its matcher, so a
  crawler got no cookie. Neither `robots()` nor the matcher had a test; this unit characterized
  both at the baseline.
- Fluenshift serves the API and the SPA from one Hono process, and its hosted session gate mints a
  cookie on every answer but the API and the build's assets (ADR 0032). The hosted profile ships
  as one Docker image, on a host the owners have not chosen (ADR 0003, decision 4). The local
  profile publishes on loopback only.

## Decision

1. In the hosted profile the server answers `GET /robots.txt` with the rules as text,
   `User-Agent: *`, `Allow: /`, `Disallow: /api/` and the sitemap's URL, and `GET /sitemap.xml`
   with Grifando's four paths in the sitemaps.org format, as `application/xml`.
2. The public origin comes from `SITE_URL` through `packages/env` (`SiteConfig`), trimmed, without
   its trailing slashes, and `http://localhost:3000` when it is unset or blank. Grifando's
   fallback to the Vercel production host is not ported.
3. The session gate mints no cookie on `/robots.txt` and `/sitemap.xml`, as Grifando's matcher
   left them out.
4. The local profile serves neither file: as before, those paths get the application shell.

## Consequences

- A hosted production server sets `SITE_URL`, beside the settings of ADR 0032 and ADR 0033. Left
  unset, both files name `http://localhost:3000`, as Grifando's did without its variables.
- The hosted Docker smoke's robots and sitemap checks (G6) stay paused with the end-to-end tests.
- A new public page joins the sitemap only through `PUBLIC_PATHS` in
  `apps/server/src/site-files.ts`.

## Alternatives

- Static files in the web build: the sitemap must name the deployment's origin, which one image
  for every host cannot know at build time.
- Keep the Vercel fallback: the product ships as one Docker image on a host the owners have not
  chosen, and a fallback for one host's variable would only mislead.
- Require `SITE_URL` in production, as `SESSION_SECRET` is: a wrong origin in two crawler files
  is not a security failure, and Grifando started without one.
