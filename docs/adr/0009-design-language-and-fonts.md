# 0009. Combine Grifando's visual system with PE's Evidence Lens layout

- Status: Proposed. Decided on {issue}; accepted when both owners accept it there.
- Seam: Phase 1 (h). Ledger rows: `decision: "adr:0009"`. This one is a matter of
  taste: the recommendation is only a default.

## Context

- PE ADR 0003, Evidence Lens: one dominant work surface with the evidence beside the writing
  that produced it; the Writing Desk is the root.
- Grifando DESIGN.md, "Warm cream editorial": a light, paper-on-paper visual system (cream
  canvas, ink text, one violet accent, no shadows), Inter Light under the OFL.
- QR-08: every bundled font, icon and asset needs a documented license.

## Decision

Grifando's visual system (colors, type, spacing, tone) applies to the whole product. PE's
Evidence Lens is the layout grammar of the Evaluation screens (Writing Desk, Evaluation
Detail, Progress); Academy screens keep Grifando's page structure in the same visual system.
Only fonts under the OFL or similar are bundled, each listed in
`docs/product/ASSET-LICENSES.md`.

## Consequences

- Rows `adr:0009` (Grifando's UI spacing and animation fixes) become `port-changed`. UI tests
  assert roles, labels and copy, not layout.

## Alternatives

- PE's visual style everywhere, or Grifando's layouts everywhere.
