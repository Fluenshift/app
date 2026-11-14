# 0001. Amend the migration protocol for the merge goal

- Status: Proposed. Decided on [#5](https://github.com/Fluenshift/app/issues/5); accepted when both owners accept it there.
- Ledger rows: `decision: "adr:0001"`.

## Context

On 2026-11-13 Jhefferson restated the goal: use the approved stack to merge the ideas of
both tools into one product, reusing baseline code where it fits. Owners review no code and
answer only explicit "human feedback needed" requests. Phase 0 surfaced five places where
`MIGRATION_PROTOCOL.md` works against that goal:

1. `informative` is allowed only for non-normative doc clauses, but the inventory also holds
   Grifando's 33 issues and 15 fix commits. Open feature requests (#61 to #68), closed issues
   whose behavior already lives in tests and SPEC sections, and commits that touch only the
   build or tests carry no behavior of their own; each would need its own `drop` ADR.
2. Phase 0 step 7 asks for browser journeys over Grifando's 11 pages in the Next.js idiom,
   with the AI faked at the network boundary, a setup the protocol lists as unverified. The
   Academy UI is rebuilt as an SPA under a design language still to be chosen (ADR 0009), so
   most of those journeys would end up `port-changed`.
3. The protocol assumes Claude Code and Codex sessions run side by side, with a coordinator
   that implements no units. In practice one Claude Code session does the work, and Codex runs
   only in the sessions an owner starts.
4. One decision issue per ADR means 17 issues for owners who read only explicit requests.
5. Phase 2 needs the `main` ruleset extended (required checks, merge queue). Agent rule 1
   forbids agents from changing rulesets.
6. Phase 2 step 6 opens one deliberately broken canary PR per gate. Most gates can be proven
   faster by a CI job that runs them over committed failing fixtures.

## Decision

1. `informative` also covers inventory rows that carry no product behavior of their own:
   issues, and commits that change only the build, tests or tooling. A verifier confirms each
   such row, as for doc clauses. Issues and commits that do carry behavior stay `port` and
   point at the tests or characterizations that pin that behavior.
2. Phase 0 step 7 characterizes Grifando at the HTTP and data level: the status and body
   shape of every endpoint (both apps), the data each Server Component page reads, and each
   behavior-bearing fix commit without a test. Browser journeys for Academy screens are written
   once, against the new SPA, from those characterizations and the SPEC sections, after ADR
   0009 is accepted. PE keeps its browser tests (Phase 4e) and its E2E journey.
3. Reusing baseline code is the default where it fits the stack: pure modules are copied with
   mechanical changes, I/O code is adapted to Effect, Hono and Drizzle. Tests still come first
   (G8): a copied module must turn its ported tests from red to green.
4. One Claude Code session coordinates and implements both lanes. It never starts another
   harness. Codex verifies PRs in the sessions the owners run, so G12's cross-vendor rule
   still holds, and a PR waits until its verdict arrives.
5. One decision issue may carry several ADRs. An owner accepts with one comment naming the ADRs
   accepted, or "all"; each ADR's status line links to that comment.
6. Once Phase 2 CI runs, the coordinator asks the owners to extend the `main` ruleset with exact
   settings, or for a one-time permission to apply them itself.
7. Gate self-tests run as one CI job: each gate runs over a committed fixture that must fail,
   and the job asserts the intended rejection. Canary PRs remain only for G8 and G12, which
   need a pull request to exist.

## Consequences

- Rows marked `adr:0001` (Grifando issues and build or test commits) become `informative`.
- `MIGRATION_PROTOCOL.md` is edited to match (dispositions, Phase 0 step 7, roles, Phase 1
  step 3, Phase 2 steps 4 and 6) in the PR that records the acceptance.
- Accepted risk: one coordinating session concentrates mistakes. G8 to G12 and the Codex
  verification of every PR are the mitigation. Merges wait for owner-run Codex sessions.

## Alternatives

- Keep the protocol as written: owners run a Codex session per unit and accept ADRs one issue at
  a time, and agents build old-idiom journeys for screens that will be redesigned.
