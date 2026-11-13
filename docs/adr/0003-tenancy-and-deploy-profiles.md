# 0003. Scope data by Learner; ship a local and a hosted profile

- Status: Proposed. Decided on {issue}; accepted when both owners accept it there.
- Seam: Phase 1 (b) and the open deploy model. Ledger rows: `decision: "adr:0003"`.

## Context

- PE is local-only: loopback binding, Host and Origin guard, no sign-up or session
  (REQUIREMENTS FR-02, FR-03, FR-24; DATA-POLICY "Local access boundary").
- Grifando is public on Vercel and Neon: a signed anonymous `ig_session` cookie per browser,
  `userId` on every table, rate limits, idle cleanup, `DELETE /api/me`, a CSP nonce and
  bring-your-own-key AI (CLAUDE.md "Public deployment model", `src/proxy.ts`).
- PRE_MIGRATION lists the deploy model as open: public hosted, self-host Docker, or data in the
  browser.

## Decision

1. Every table is scoped by Learner from the first migration.
2. One codebase, two deploy profiles chosen by Config:
   - `local`, built first (Phases 2 to 4): Docker on the learner's machine, published on
     loopback only, Host and Origin guard, one implicit Learner, no session, the AI key read
     from server config. PE's FR-02, FR-03 and FR-24 hold in this profile.
   - `hosted` (Phase 6): the public site that replaces grifando.vercel.app. One Learner per
     signed anonymous session cookie, a CSP for a static SPA, Postgres fixed-window rate limits
     per Learner and per hashed IP, 90-day idle cleanup (ADR 0011), `DELETE /api/me`, a privacy
     page in English and Portuguese, and AI keys that travel only in request headers.
3. Keeping data only in the browser is not pursued.
4. The product ships as one Docker image (one Node process serving API and SPA). The host for
   the hosted profile is chosen in Phase 6.

## Consequences

- Rows `adr:0003`: hosted-profile rows become `port` (re-expressed on Hono) or `port-changed`
  where Next.js did the work (the nonce CSP becomes a static-SPA CSP; the cookie is set by the
  API instead of the first render). FR-02, FR-03 and FR-24 become per-profile (`port-changed`).
- The deploy-profile Config and the Learner identity service are Phase 2 step 3.

## Alternatives

- Local only: every hosted row is dropped and Grifando's public site goes away.
- Hosted only: PE's local guarantees are dropped.
