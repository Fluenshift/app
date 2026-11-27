# 0047. Grifando is source-available under the PolyForm Noncommercial License 1.0.0

- Status: Accepted on 2026-11-27. Jhefferson asked a session for a license more restrictive than
  MIT, with the repository kept public, and chose it among the options the session gave (#356).
- Replaces the MIT License that `LICENSE` held from the repository's first commit.

## Context

- `LICENSE` granted the MIT License, and the repository is public (ADR 0045): anyone could use
  the code for any purpose, selling it included.
- The owners mean Grifando to be a service that may be monetized (ADR 0046, decision 5). Others
  may run their own instance, but only the owners may use it commercially.
- Making the repository private instead was weighed and rejected. The organization is on GitHub's
  Free plan, where a private repository spends a quota of 2,000 Actions minutes a month: about
  110 pull requests with code, at about 18 minutes each for the pull request's run and the merge's
  run, against 113 merged in the week before this ADR. It would also lose CodeQL's default setup
  and the enforcement of the `main` ruleset.

## Decision

1. Grifando's code and the owners' own assets are licensed under the PolyForm Noncommercial
   License 1.0.0. `LICENSE` holds its official text verbatim, after the line
   `Required Notice: Copyright 2026 Fluenshift (https://github.com/Fluenshift)`. Anyone may read,
   run, change and share Grifando for a noncommercial purpose; commercial use needs a separate
   license from Fluenshift.
2. The repository stays public.
3. Grifando is called source-available, never open source: a license that forbids commercial use
   does not meet the Open Source Definition.
4. Third-party code, fonts and assets keep their own licenses (`docs/product/ASSET-LICENSES.md`
   and each dependency's own).

## Consequences

- The change binds the versions published from this ADR on. Whoever took a copy of an earlier
  commit keeps the MIT License for that copy; the repository had no fork when the license changed.
- Before accepting a contribution from outside the owners, they need an agreement, such as a
  contributor license agreement, that lets Fluenshift license the contribution commercially.
- The `local` profile stays the way to run one's own instance, within the license.

## Alternatives

- The Functional Source License 1.1: forbids only use that competes with the owners, and turns
  each version into Apache 2.0 after two years. Jhefferson chose the more restrictive license.
- No license while public: nobody could run their own instance, not even for study.
- Keep the MIT License: anyone could sell Grifando.
