# Bundled asset licenses

QR-08: every bundled font, icon and visual asset has a documented license. The production
bundle contains no font files, images, logos or third-party runtime requests. Typography falls
back to the system font stack until the faces of the visual system (ADR 0009) are bundled,
each with its row here; graphs are CSS.

| Asset | Source | Version | License |
| --- | --- | --- | --- |
| Interface icons | [`lucide-react`](https://github.com/lucide-icons/lucide) | 1.72.0 | ISC; Feather-derived icons MIT |
| Utility CSS | [`tailwindcss`](https://github.com/tailwindlabs/tailwindcss) | 4.3.5 | MIT |
| Toast component, CSS, embedded status icons | [`sonner`](https://github.com/emilkowalski/sonner) | 2.0.8 | MIT |
| Dialog, popover and button primitives | [`@base-ui/react`](https://github.com/mui/base-ui) | 1.9.0 | MIT |
| Palette, shapes and type scale | Grifando's `src/app/globals.css` (ADR 0009), adapted in `packages/ui/src/styles/globals.css` | 74dbb9f | MIT, the owners' own work |

All permit redistribution with the copyright and license notice retained.

Re-check by walking imports from `apps/web/src/main.tsx`, static files under `apps/web` and
`packages/ui`, and installed dependency license metadata. Test-only and dev-only modules are
not in the bundle.
