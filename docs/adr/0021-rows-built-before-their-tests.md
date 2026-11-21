# 0021. Rows whose behavior an earlier unit built

- Status: Accepted on 2026-11-17 by the session (ADR 0020). Consequences corrected on
  2026-11-21 (#270), to name the Trainer row the decision superseded.
- Ledger rows: `decision: "adr:0021"`.

## Context

G8 accepts a ledger target only when its test fails at the first commit of the pull request
that adds it. Some units built a behavior before the row that describes it was ported: #47
built the request guards of a row that #63 then could not port, #65 built both Progress
evidence routes while the two rows of #66 waited on a decision, and #96 built the provider
status mapping that `accessErrorForStatus > classifies provider statuses` pins. A ported test of
such a row passes at its first commit, so it can never be a G8 target, and the row stays open
for good.

## Decision

1. A row whose ported test passes before any code of its unit, because an earlier unit built
   the behavior, becomes `superseded` with `decision: "adr:0021"`.
2. The unit still ports the test, title as written and with the mechanical changes the mapping
   table allows, so that the behavior stays pinned. The test is not a ledger target. The pull
   request names the row, the test and the unit that built the behavior.
3. G8 stays as it is: every target is still red first.

## Consequences

- `evaluation-http`: `Progress endpoints > selects evidence by insight, Error Category or
  correction` and `Progress endpoints > refuses an unknown insight, an unknown category, a half
  correction and a bad period` are superseded by their ported tests in
  `apps/server/src/app.test.ts`, with the Correction in the body of
  `POST /api/progress/evidence` (ADR 0008). #65 built both routes.
- The key test unit (#136) applies it to `POST /api/ai-key/test > answers busy when the
  provider does not answer in time`, and pins that behavior at the Trainer client rather than
  under the row's title (`trainer-client.test.ts`, "reads a provider that does not answer in 15
  seconds as busy, and stops waiting"). `accessErrorForStatus > classifies provider statuses`
  stayed a target, because its test failed first (#134).
- A superseded row has no target, so the parity check counts it as terminal, not verified.

## Alternatives

- A G8 exception list: a gate change that would also let a target that never failed slip
  through.
- Leave such rows open: parity could never reach 100%.
