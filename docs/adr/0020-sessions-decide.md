# 0020. Sessions decide; owners review nothing

- Status: Accepted on 2026-11-16, at the request of Jhefferson in a Claude Code session.
- Amends ADR 0001 and ADR 0019, `AGENTS.md` and `MIGRATION_PROTOCOL.md`. Ledger rows:
  `decision: "adr:0020"`.

## Context

On 2026-11-16 Jhefferson wrote that he will not review, accept or answer anything, and asked
sessions to merge their work: he wants the migration finished so that feature work can start.
At that point eight requests waited on an owner (#5, #63, #66, #72, #87, #101, #110, #119),
some for two days. Every one of them already named a recommended option, and the rules told
sessions to stop and wait for an answer that will not come.

## Decision

1. **Sessions decide.** A question the migration raises, product details at the seams
   included, is decided by the session that meets it: it takes the option it would recommend,
   records the choice in an ADR when it changes a ledger disposition, a gate or product
   behavior, and goes on. No session opens a decision request or waits for an answer.
2. **An ADR is in force when its pull request merges.** Its status line reads "Accepted on
   <date>", with the session or the owner that asked for it.
3. **The stop rule moves on instead of waiting.** After two failed attempts at the same gate
   failure, the session posts the failing output on the unit's issue and takes other work.
4. **What stays with the owners** is what cannot be undone outside this repository or costs
   money: changing or archiving the source repositories, moving production, organization
   settings, and the budget of paid calibration. Sessions never start these; the handoff lists
   them.
5. **The open requests are decided** as their recommendations said:
   - #5: the ADRs stand on Jhefferson's acceptance; Levy's is no longer awaited.
   - #63: the row `request guards > forbids a remote host, a foreign Host header, a cross-site
     fetch and a foreign Origin alike` is `superseded` by the guard tests of #47, which pin each
     of its four refusals.
   - #66: the two Progress characterization rows that send a Correction become `port-changed`
     under ADR 0008: their Correction travels in the body of `POST /api/progress/evidence`.
   - #72: no new timeout. The database suite already runs before the heavy suites (#82, #116),
     and the server's tests copy a migrated database (#112).
   - #87: new Evaluations record a provisional Rubric Version distinct from PE's `"1"` until
     live calibration passes; a unit implements it before the PE importer of Phase 7.
   - #101: a Naturalness Note grows its Mistake Pattern's occurrence count, so practice can
     target it, but it is never a failed recall: no incorrect count, no demotion.
   - #110: until cutover, Grifando takes production and security fixes only, each ported
     through a baseline bump. Jhefferson's sessions hold the shared files.
   - #119: the Trainer may receive the whole Writing Sample of either origin, as
     `DATA-POLICY.md` now states; the merge keeps Grifando's simple Streak, the searchable
     Mistake Notebook and the Trainer's provider chosen by the Learner's key, with the Judge
     still pinned; FR-01 and QR-07 bind the local profile only.

## Consequences

- G14 keeps only the owner actions of decision 4.
- The labels `needs-info`, `decision` and `ready-for-human` are no longer applied.
- A session can be wrong where an owner would have chosen otherwise. Every choice is an ADR
  or a pull request, so an owner who disagrees later changes it the same way.
- The provenance of the visual style (#119, question 4) stays an owner fact; nothing waits on it.

## Alternatives

- Keep decision requests and act on silence after a delay: it keeps the ceremony and the wait.
