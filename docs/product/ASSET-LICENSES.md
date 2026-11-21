# Bundled asset licenses

QR-08: every bundled font, icon and visual asset has a documented license. The production
bundle contains no font files or logos, and two images: the Open Graph card that link previews
load (ADR 0040), and the hand-drawn arrow of the Academy's hero note, an inline SVG. It makes no third-party runtime request until the Learner opens Focus Music,
which loads the Spotify or YouTube player they chose (ADR 0039).
Typography falls back to the system font stack until the faces of the visual system (ADR 0009)
are bundled, each with its row here; graphs are CSS.

| Asset | Source | Version | License |
| --- | --- | --- | --- |
| Interface icons | [`lucide-react`](https://github.com/lucide-icons/lucide) | 1.72.0 | ISC; Feather-derived icons MIT |
| Utility CSS | [`tailwindcss`](https://github.com/tailwindlabs/tailwindcss) | 4.3.5 | MIT |
| Toast component, CSS, embedded status icons | [`sonner`](https://github.com/emilkowalski/sonner) | 2.0.8 | MIT |
| Dialog, popover and button primitives | [`@base-ui/react`](https://github.com/mui/base-ui) | 1.9.0 | MIT |
| Palette, shapes and type scale | Grifando's `src/app/globals.css` (ADR 0009), adapted in `packages/ui/src/styles/globals.css` | 74dbb9f | MIT, the owners' own work |
| Hero note arrow, inline SVG in `apps/web/src/features/academy/hero-note.tsx` | Grifando's `src/components/home/HeroNote.tsx` | 74dbb9f | MIT, the owners' own work |
| Open Graph card, `apps/web/public/og-image.png` | Grifando's `src/app/opengraph-image.tsx` (ADR 0040), with Fluenshift's name, drawn in Inter Light from Grifando's `src/app/fonts/` | 74dbb9f | The card: MIT, the owners' own work. Inter: SIL OFL 1.1, which leaves images made with the font free |

All permit redistribution with the copyright and license notice retained.

Re-check by walking imports from `apps/web/src/main.tsx`, static files under `apps/web` and
`packages/ui`, and installed dependency license metadata. Test-only and dev-only modules are
not in the bundle.
