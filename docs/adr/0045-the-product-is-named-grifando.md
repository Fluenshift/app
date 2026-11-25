# 0045. The product is named Grifando

- Status: Accepted on 2026-11-25. The owners chose the name, and Jhefferson asked a session to
  apply it (#352). Answers the first question of #333.
- Supersedes the product's name in ADR 0036 (decision 2, "Fluenshift in place of Grifando") and
  ADR 0040 (decisions 2 and 3). ADR 0044 kept the repository public until this choice; it stays
  public.

## Context

- The merged product shipped under the organization's name, Fluenshift, from a repository with
  the working name `app` (#333). Its workspace packages were `@fluenshift/*` and its Compose
  project `fluenshift`.
- One of its two source products was Grifando, whose private, archived repository held the name
  `Fluenshift/grifando`.
- On 2026-11-25 the owners named the merged product Grifando, and asked for the source
  repository to take a name such as old-grifando.
- Hundreds of comments, tests and ADRs say "Grifando's" for the source product, mostly beside
  one of its source paths or the commit `74dbb9f`.

## Decision

1. The product is Grifando. Fluenshift names only the GitHub organization, which holds the
   copyright in `LICENSE`.
2. On GitHub, `Fluenshift/grifando` became `Fluenshift/old-grifando` (unarchived, renamed and
   archived again, still private), and then `Fluenshift/app` became `Fluenshift/grifando`, to
   which GitHub redirects `Fluenshift/app`. The checkouts follow: `$F/grifando` and
   `$F/old-grifando`.
3. The source product is old Grifando. Text written before this ADR keeps its words: in it,
   Fluenshift is the product and Grifando the source product. New text says old Grifando.
4. The interface, the shell's metadata and the link preview say Grifando. The Open Graph card
   keeps ADR 0040's layout, the name with no glyph, rendered again at 1200 by 630 with satori
   and resvg; old Grifando's glyph waits for the owners' choice of a logo (#333).
5. Every identifier that named the product follows it: the workspace packages and the Effect
   service ids built from them are `@grifando/*`, the root package is `grifando`, the Compose
   project is `grifando` with `GRIFANDO_UID`, `GRIFANDO_GID` and `GRIFANDO_DATA_DIR`, and the
   tests' scratch directories start with `grifando-`.

## Consequences

- A local container started before this change belongs to the Compose project `fluenshift`:
  stop it once with `docker compose --project-name fluenshift down`. Its data stays in
  `./.data`. A shell that set `FLUENSHIFT_DATA_DIR` sets `GRIFANDO_DATA_DIR` instead.
- A branch cut before this change that imports `@fluenshift/*` or names the old variables fails
  its checks once rebased, until it takes the new names.
- G11's baseline records the restricted import of `@grifando/db` where it recorded
  `@fluenshift/db`: the same rule under the new name.
- A clone whose `origin` named `Fluenshift/grifando` for old Grifando now fetches this
  repository: point it at `Fluenshift/old-grifando`.
- Rendering the card again starts from old Grifando's `src/app/opengraph-image.tsx` at
  `74dbb9f`, without the glyph. satori 0.63 needs `boxSizing: "border-box"` on the root to keep
  the padding inside the 630 pixels.
- The logo and the visual style stay open on #333.

## Alternatives

- Keep `@fluenshift/*` as the organization's scope: fewer changed lines, but #333 listed the
  scope among the places of the product's name, and the code would carry two names for one
  product.
- Rewrite every earlier "Grifando" that means the source product: hundreds of lines whose source
  path or commit already says which product they mean.
- Old Grifando's card with its glyph: the glyph is a logo, and the owners have not chosen one for
  the product.
