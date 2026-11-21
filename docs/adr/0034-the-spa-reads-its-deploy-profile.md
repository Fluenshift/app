# 0034. The SPA reads its Deploy Profile; only the hosted one sends the browser's AI key

- Status: Accepted on 2026-11-20 by the session (ADR 0020), with the Phase 6 BYOK unit (#229).
- Phase 6, requirement HR-05. No ledger row changes its disposition: Grifando's `/settings`
  page, `AIKeyForm` and the callers of `aiFetch` have no test at the baseline and port from
  source (ADR 0025, decision 5); `academy-spec`'s `grifando:fix-commit:2a86084` stays `port`.

## Context

- ADR 0012, decision 3: the `local` profile reads AI keys from server configuration, and the
  `hosted` profile takes the visitor's keys from request headers only. On the server,
  `resolveTrainerCredentials` reads the request's key first and, in the local profile only,
  falls back to the configured one; a hosted Trainer route without a key answers 401
  `AI_KEY_REQUIRED`.
- One build of the SPA serves both profiles, from the one image of ADR 0003, decision 4, so the
  SPA cannot know its profile when it is built.
- #224 ported Grifando's key store and `aiFetch`, which attaches the stored key in the
  `x-ai-provider` and `x-ai-key` headers, or rejects with `MissingAIKeyError` before any request
  when the browser holds none. Nothing calls them yet.
- Grifando sends five calls through `aiFetch`: a practice set's generation, an Attempt's
  explanation, an interview's start and its answers, and its writing route, which practice
  writing replaces (ADR 0026). Its `/settings` page stores the key and tests it through
  `POST /api/ai-key/test`; its key notice and its navigation's "Key" entry link there.
- PE's Setup & privacy page tells the local Learner that provider credentials stay on the
  server.

## Decision

1. `GET /api/deploy-profile` answers `{ "deployProfile": "local" }` or
   `{ "deployProfile": "hosted" }`, the profile of the process, under a `packages/contract`
   schema. In the hosted profile it sits behind the session gate like every API route but the
   health check (ADR 0032): the application shell mints the cookie before the SPA asks.
2. The SPA reads it once, in `main.tsx`, before it builds its clients and its router, and the
   router context carries it. An answer that fails or does not decode reads as `local`, the
   profile that never stores or sends a key from the browser. A router built without one, as the
   screen tests build it, is in the local profile.
3. In the hosted profile the HTTP Academy client sends Grifando's five calls and the key test
   through `aiFetch`; every other call, and every call of the local profile, goes without the
   key.
4. `isKeyRequired` recognizes `MissingAIKeyError`, so a screen shows Grifando's key notice when
   the browser holds no key, as it does when the server finds none.
5. In the hosted profile the key notice links to `/settings`, and the Academy navigation ends
   with Grifando's "Key" entry. In the local profile the notice keeps its link to `/setup`, and
   the navigation has no "Key" entry.
6. `/settings` renders Grifando's page and its `AIKeyForm` in the hosted profile, the form's
   message for blocked storage included. In the local profile it redirects to `/setup`, where
   the server's key is explained, so a local browser never stores one.

## Consequences

- The SPA's first render waits for one more request.
- A hosted SPA that cannot read its profile acts as local until it is reloaded: its Trainer calls
  go without a key and answer `AI_KEY_REQUIRED`, and no key leaves the browser.
- The local server still reads a key from request headers first; the SPA never sends it one.
- This decides the Trainer's key only. The Judge's key in the hosted profile is #228.

## Alternatives

- Read the profile in the root route's `beforeLoad` through the Academy client: TanStack Router
  runs it on every navigation, and the Evaluation screens' routers have no Academy client.
- Build the profile into the SPA: one image per profile, against ADR 0003, decision 4.
- Store and send the browser's key in both profiles: the local server would prefer a key from
  the browser over its own, against PE's promise that credentials stay on the server.
- Answer the profile from `GET /api/sample-limits` or `GET /api/setup`: either would mix the
  profile into an answer about something else.
