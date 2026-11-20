# 0029. Grifando's layout and motion fixes have no test target

- Status: Accepted on 2026-11-20 by the session (ADR 0020).
- Phase 5f. Ledger rows: `grifando:fix-commit:9f5e47e` and `grifando:fix-commit:397b0b4`,
  `decision: "adr:0029"`.

## Context

- ADR 0009 made Grifando's UI spacing and animation fixes `port-changed`, and says UI tests
  assert roles, labels and copy, not layout.
- `9f5e47e` adds the Field, Stack and Actions spacing roles and moves Grifando's form controls off
  their fields and card edges. It changes class names only: no role, label, copy or request.
- `397b0b4` wraps each dashboard block in its own scroll reveal, because a block taller than the
  screen never reached its reveal threshold, and stops a number already on screen at mount from
  counting up from zero. Both repair Grifando's scroll reveal (`useInView`, `Reveal`) and its
  `CountUp`.
- The Academy's screens are ported from the pinned commit, which already holds `9f5e47e`: the
  practice writing sheet keeps Grifando's action row. The Academy dashboard was ported without the
  scroll reveal and the count-up (`apps/web/src/features/academy/dashboard.tsx`): its entrance
  motion is a CSS delay, which needs no scrolling.

## Decision

1. `grifando:fix-commit:9f5e47e` becomes `informative`: its spacing comes with each screen ported
   from the pin, and layout stays out of tests (ADR 0009).
2. `grifando:fix-commit:397b0b4` becomes `drop`: the scroll reveal and the count-up it repairs are
   not ported, so no block waits for a reveal and no number counts up.
3. A screen that later ports Grifando's scroll reveal or count-up takes them from the pin, with
   this fix.

## Consequences

- Both rows are terminal. The other two open fix commits of the slice wait for Phase 6:
  `2a86084` is the browser key store of BYOK, and `9ba8040` the rate limit before a hosted
  session.

## Alternatives

- Assert class names or `data-slot` attributes in screen tests: they would pin markup, not
  behavior, which ADR 0009 rules out.
- Port the scroll reveal and the count-up so that `397b0b4` has something to repair: motion that
  no requirement asks for.
