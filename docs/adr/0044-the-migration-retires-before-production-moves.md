# 0044. The migration retires before production moves

- Status: Accepted on 2026-11-21, at the request of Jhefferson in a Claude Code session (#324).
- Later on 2026-11-21, at Jhefferson's request, a session made `Fluenshift/prompt-evolution` and
  `Fluenshift/grifando` private, then archived them (decision 6). `Fluenshift/app` stays public
  until the owners choose its name (#333): on GitHub's Free plan a private repository loses
  unlimited Actions minutes, code scanning and the enforcement of its rules.
- Amends ADR 0019 and ADR 0020 (the gates that run), `AGENTS.md`, and the order of Phase 7 in
  the retired `docs/migration/MIGRATION_PROTOCOL.md`. Retires G8, G9, G10 and the checks of the
  baseline pins and the inventory.

## Context

- Phase 7, items 1 to 3, signed off on 2026-11-21 (#323): every ledger row terminal (889 rows,
  609 verified, 280 terminal), every gate green on a fresh clone, and the inventory reproduced
  byte for byte from the baseline tags.
- The protocol removed the migration material only at cutover, once production had moved and the
  source repositories were archived. Those steps are the owners', and they wait on choices the
  owners have not made: the host, and Grifando's notice period.
- The owners will redesign the interface and decide which features stay, change or go (#320).
  Under the porting rules, every such change to a ported test needs an ADR and a `port-changed`
  row, and G8, G9 and G10 hold the code to the ledger.
- On 2026-11-21 Jhefferson asked for the migration material to go now, before production moves.

## Decision

1. `docs/migration/` (the protocol, the ledger, the inventory, the baselines and their runs),
   `migration/` (the characterization tests and fixtures) and `scripts/migration/` leave the
   repository in one commit. Git history keeps them at 8a379e2, the last commit of `main` that
   holds them.
2. G8 (red-green on ledger targets), G9 (the parity check), G10 (the parity audit) and the checks
   of the baseline pins and the inventory retire, with their CI jobs and their self-tests. The
   tests that were ledger targets stay, as the product's tests.
3. G1 to G7 and G11 stay. G6 runs the Docker smoke of both Deploy Profiles. G13 stays deferred
   until the owners schedule live calibration. `gates/baseline.json` is recorded again without
   the retired gates.
4. Tests still come first: a unit's first commit holds its failing tests.
5. `SESSION_HANDOFF.md` retires. Work in flight and next steps live in GitHub issues, and the
   facts it kept move to `docs/engineering-notes.md`.
6. What waits for the owners, unchanged: the go-ahead for cutover; the host of the hosted profile
   and its settings (`SESSION_SECRET`, `IP_HASH_SALT`, `CLIENT_IP_HEADER`, `SITE_URL`); Grifando's
   notice for at least 30 days before production moves and its read-only database for 30 days
   after (ADR 0018); archiving `Fluenshift/grifando` and `Fluenshift/prompt-evolution`; the
   import of PE's local history (`README.md`); the budget of live calibration; and where
   Grifando's visual style came from, for `docs/product/ASSET-LICENSES.md`.

## Consequences

- The porting rules end: titles, expected values and matchers of a former ledger target change
  for the product's own reasons, with an ADR when product behavior changes.
- A comment that cites `migration/...` or `docs/migration/...` names a file at 8a379e2:
  `git show 8a379e2:<path>`.
- A fix to Grifando's production before cutover is ported by hand, as any change.

## Alternatives

- Keep the material until production moves, as the protocol ordered: the redesign and the
  feature decisions would carry the porting rules until the owners pick a host.
- Keep G8 for every new test: without ledger targets it has nothing to select, and a red-first
  gate for new tests is a unit of its own if the owners want one.
