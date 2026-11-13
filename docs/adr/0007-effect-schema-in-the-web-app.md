# 0007. Share Effect Schema with the web app through packages/contract

- Status: Proposed. Decided on {issue}; accepted when both owners accept it there.
- Seam: Phase 1 (f). Supersedes the web clause of PE ADR 0002.

## Context

PE ADR 0002 keeps Effect out of `apps/web`, with Zod in the browser. The approved stack puts
Effect Schema everywhere, in a shared `packages/contract`, with no Zod in code.

## Decision

`packages/contract` holds the Effect Schema definitions of every API request and response.
`apps/server` and `apps/web` both import it; the web decodes API responses with those schemas.
Effect services, layers and runtimes stay out of `apps/web`, which keeps React code plain.

## Consequences

- No ledger row changes. G2 bans `zod` imports in code; Zod may remain only as an AI SDK peer.

## Alternatives

- Hand-written web types: drift between server and web would no longer fail the build.
