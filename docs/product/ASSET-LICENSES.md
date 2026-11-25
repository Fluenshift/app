# Bundled asset licenses

QR-08: every bundled font, icon and visual asset has a documented license. The production
bundle contains the font files below, no logos, and two images: the Open Graph card that link
previews load (ADR 0040), and the hand-drawn arrow of the Academy's hero note, an inline SVG. It
makes no third-party runtime request until the Learner opens Focus Music, which loads the Spotify
or YouTube player they chose (ADR 0039). Old Grifando's three faces are served by the build
itself, latin only (ADR 0009); graphs are CSS.

| Asset | Source | Version | License |
| --- | --- | --- | --- |
| Inter, latin, weights 300, 400 and 500 | [`@fontsource/inter`](https://github.com/fontsource/font-files) | 5.3.0 | SIL OFL 1.1 |
| Source Serif 4, latin, weights 300 and 400, normal and italic | [`@fontsource/source-serif-4`](https://github.com/fontsource/font-files) | 5.3.1 | SIL OFL 1.1 |
| JetBrains Mono, latin, weights 400 and 500 | [`@fontsource/jetbrains-mono`](https://github.com/fontsource/font-files) | 5.3.0 | SIL OFL 1.1 |
| Interface icons | [`lucide-react`](https://github.com/lucide-icons/lucide) | 1.72.0 | ISC; Feather-derived icons MIT |
| Utility CSS | [`tailwindcss`](https://github.com/tailwindlabs/tailwindcss) | 4.3.5 | MIT |
| Toast component, CSS, embedded status icons | [`sonner`](https://github.com/emilkowalski/sonner) | 2.0.8 | MIT |
| Dialog, popover and button primitives | [`@base-ui/react`](https://github.com/mui/base-ui) | 1.9.0 | MIT |
| Palette, shapes and type scale | Old Grifando's `src/app/globals.css` (ADR 0009), adapted in `packages/ui/src/styles/globals.css` | 74dbb9f | MIT, the owners' own work |
| Hero note arrow, inline SVG in `apps/web/src/features/academy/hero-note.tsx` | Old Grifando's `src/components/home/HeroNote.tsx` | 74dbb9f | MIT, the owners' own work |
| Open Graph card, `apps/web/public/og-image.png` | Old Grifando's `src/app/opengraph-image.tsx` (ADR 0040), with the product's name and no glyph (ADR 0045), drawn in Inter Light from its `src/app/fonts/` | 74dbb9f | The card: MIT, the owners' own work. Inter: SIL OFL 1.1, which leaves images made with the font free |

All permit redistribution with the copyright and license notice retained.

Re-check by walking imports from `apps/web/src/main.tsx`, static files under `apps/web` and
`packages/ui`, and installed dependency license metadata. Test-only and dev-only modules are
not in the bundle.
