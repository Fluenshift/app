# 0032. The hosted request pipeline

- Status: Accepted on 2026-11-20 by the session (ADR 0020), with the first Phase 6 unit (#214).
- Phase 6, the hosted profile's request pipeline. Refines ADR 0003 for the `adr:0003` rows of
  Grifando's `src/proxy.test.ts`; the characterizations of `next.config.ts`, of the minted
  cookie and of `getSessionSecret` stay `port`.

## Context

- Grifando's `src/proxy.ts` ran before each Next.js render and each API route. It minted the
  signed `ig_session` cookie when a request had no valid one, forwarded it to the same render,
  answered an API request without a valid cookie with 401 `SESSION_REQUIRED` and minted nothing
  there (fix `9ba8040`), and set a CSP with a per-request nonce. `next.config.ts` added four
  security headers to every path. `getSessionSecret` threw on each request when production had
  no `SESSION_SECRET`, and fix `9ba8040` also failed the Vercel build in that case.
- The product serves a static single-page application from the same Hono process as the API
  (ADR 0003). No server render reads a cookie, and the SPA's `index.html` has no inline script.
  The process serves the SPA only in production; in development Vite serves it.
- The local profile already refuses foreign Host and Origin headers (PE). Phase 6 of
  `MIGRATION_PROTOCOL.md` listed an Origin check on every state-changing hosted request, which
  no source had.

## Decision

1. In the hosted profile, two Hono middlewares run before every route. The first sets the CSP and
   Grifando's security headers on every answer, refusals included. The second, the session gate,
   runs after the body-size guard of ADR 0006, so an oversized body is refused before its session
   is checked.
2. An API request needs a valid session cookie, or gets Grifando's 401 `SESSION_REQUIRED` and no
   cookie. `GET /api/health` is the only exception, so that a host's health check needs no
   session. Any other request without a valid session gets a new cookie on its answer, the
   application shell, where Grifando forwarded the cookie to a render. The build's static files
   under `/assets/` get none, because caches keep their answers.
3. The CSP is one static policy: Grifando's, with `script-src 'self'` in place of the nonce and
   `'strict-dynamic'`, and without the development variant's `'unsafe-eval'`, since the process
   never serves the SPA in development.
4. The hosted profile has no Origin check. `SameSite=Lax` keeps the session cookie off a
   cross-site request that changes state, so the session gate refuses that request. A check that
   compares the Origin with the request's URL would also refuse every request behind a proxy
   that ends TLS, because the URL that proxy forwards is `http`.
5. `SESSION_SECRET` is read by the hosted profile only. In production the server does not start
   without it, where Grifando failed its build. Elsewhere it falls back to Grifando's fixed
   development secret and logs a warning. To rotate the secret, change it and restart. Every
   session then becomes invalid: each browser gets a new cookie and a new, empty Learner on its
   next visit. The old Learners' data cannot be reached any more, and the idle cleanup
   (ADR 0011) deletes it 90 days after their last write. Grifando verified with one secret only,
   and so does the product.

## Consequences

- `MIGRATION_PROTOCOL.md` (Phase 6) and `DATA-POLICY.md` (Hosted profile) say what decisions 4
  and 5 decide.
- A hosted request reaches a route only with a valid session, so a route that meets
  `MissingSessionError` has a defect and answers the generic 500.
- `ensureLearner`, Grifando's `ensureUser`, records each write's activity for the idle cleanup.
  The rate-limit unit wires it into the write routes, after the rate limit, in the order fix
  `9ba8040` set.

## Alternatives

- Mint the cookie from an API endpoint that the SPA calls first: one more request on every first
  visit, and an API route that mints, which fix `9ba8040` forbade.
- Accept a previous secret while a new one takes over: no source did, and it keeps the old
  secret valid for as long as the overlap lasts.
- Gate only the API routes that act for a Learner: `GET /api/setup` and `GET /api/sample-limits`
  would answer without a session, where Grifando gated every API route.
