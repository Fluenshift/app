# 0040. The shell carries Grifando's link preview, and no landing page is prerendered

- Status: Accepted on 2026-11-21 by the session (ADR 0020), with the Phase 6 landing page and
  Open Graph image unit (#253).
- Phase 6, item 3 (`docs/migration/MIGRATION_PROTOCOL.md`: "landing page and OG image generated
  at build time"), and ADR 0000 ("landing page and OG image static at build"). Grifando's
  metadata in `src/app/layout.tsx` and its card in `src/app/opengraph-image.tsx` (74dbb9f) have
  no test at the baseline and port from source, as ADR 0025, decision 5, ports Grifando's
  client components. No ledger row covers them.

## Context

- Grifando's root layout declared its metadata: the description "Personal writing coach for
  English, built from your own mistakes.", an Open Graph `website` with its site name, title and
  description, and a `summary_large_image` Twitter card. Next.js added the tags of
  `opengraph-image.tsx`: a 1200 by 630 card, rendered by `next/og` in Inter Light, with
  Grifando's glyph and name, the sentence "She don't like coffee." with "don't" underlined, and
  "A personal English coach built from your own mistakes." `metadataBase` put the card's URL at
  the public origin, and Grifando's proxy matcher left the card outside the session.
- Grifando prerendered no page. Its root layout waited for the request (`connection()`) because
  of the CSP nonce, and its `/` read the Learner's data (`force-dynamic`). In Fluenshift, `/`
  (the Writing Desk) and `/academy` (ADR 0025) also read the Learner's data at runtime.
- Fluenshift's `index.html` had a title only. One Docker image serves every host, so no build
  knows the public origin; the hosted server reads it from `SITE_URL` (ADR 0037). Open Graph
  wants an absolute image URL.
- Fluenshift uses Grifando's visual system under its own name (ADR 0009), and has no logo.

## Decision

1. No page is prerendered. What a visitor lands on depends on the Learner, as it did in
   Grifando; only the shell is the same for every visitor, so "landing page static at build"
   means the shell's metadata.
2. `index.html` carries Grifando's metadata with Fluenshift's name, static at build in both
   profiles: the description, `og:type`, `og:site_name`, `og:title`, `og:description`, and the
   Twitter card, title and description.
3. The Open Graph card is Grifando's, with "Fluenshift" in place of Grifando's glyph and name. It
   was rendered once at 1200 by 630 with satori and resvg, the renderer `next/og` uses, and is
   committed as `apps/web/public/og-image.png`, which every build copies to its root.
4. The hosted server adds the card's tags before the `</head>` of the shell it serves, as
   Next.js wrote them: `og:image` at `SITE_URL` followed by `/og-image.png`, then its type, size
   and alt text. It serves `/og-image.png` with no session cookie, as Grifando's matcher left the
   card. The local profile, on loopback only, does neither.

## Consequences

- A link to the hosted profile previews the card when `SITE_URL` names the public origin. Left
  unset, the card's URL names `http://localhost:3000`, as robots.txt and the sitemap do.
- A new brand renders the card again at 1200 by 630; `apps/web/src/link-preview.test.ts` checks
  its size and the shell's metadata.
- `docs/product/ASSET-LICENSES.md` lists the card.
- A crawler that runs no script reads the shell's metadata and no page content, which ADR 0000
  accepted with the SPA ("Revisit Start if SEO for dynamic public pages becomes central").

## Alternatives

- Prerender `/` or `/academy` at build: both read the Learner's data, so the build would freeze
  an empty Learner's page that the SPA then replaces.
- Render the card in a Vite plugin at every build, as the protocol words it: satori, resvg and
  Inter's font file would join the build for a file that changes only with the brand, and the
  Vite configuration that G11 records would change.
- A relative `og:image` in the static shell: Open Graph wants an absolute URL, and some link
  previews drop a relative one.
- No card: links to the hosted profile would lose the image Grifando's links showed.
