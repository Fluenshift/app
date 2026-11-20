# 0033. Hosted rate limits

- Status: Accepted on 2026-11-20 by the session (ADR 0020), with the Phase 6 rate-limit unit
  (#218).
- Phase 6, requirement HR-03. The rows of Grifando's `src/server/rateLimit.test.ts`,
  `src/server/clientIp.test.ts` and their characterizations stay `port`; `academy-spec`'s
  `grifando:fix-commit:9ba8040` stays `port-changed` under ADR 0003.

## Context

- Grifando counted calls in Postgres fixed windows (`RateLimitWindow`), per user and per salted
  hash of the client IP, which it read from the first `x-forwarded-for` entry that Vercel sets.
  Each state-changing route checked its body, then the AI key, then its bucket of limits, then
  created the user (`ensureUser`, fix `9ba8040`), then did its work. `IP_HASH_SALT` was required
  in production, and its build failed without it.
- PE had no rate limits: it runs on the learner's machine. Its `POST /api/evaluations` calls the
  Judge, and its `DELETE /api/evaluations/:id` deletes an Evaluation. Its
  `POST /api/progress/evidence` is a read in a request body (ADR 0008).
- ADR 0003 scopes every table by Learner. A window keyed by a hashed IP belongs to no Learner.
- The product runs as one container behind whichever proxy the host provides; each host puts the
  client IP in its own header.

## Decision

1. The hosted profile ports Grifando's limits, buckets, message and fixed windows unchanged.
   The local profile has none, as PE had none.
2. Every state-changing route admits its call in Grifando's order: after its body check and,
   for a route that calls the Trainer, after it finds a key in the request, the rate limit,
   then `ensureLearner`, then its work. A Trainer route whose request carries no usable key is
   not counted, and answers for the key as before. A refused call gets Grifando's 429 body with
   `Retry-After`.
3. PE's routes take Grifando's buckets by what they do: `POST /api/evaluations`, which calls the
   Judge, counts against `analysis`, like Grifando's writing route; `DELETE
   /api/evaluations/:id` counts against `write`. Reads, `POST /api/progress/evidence` included,
   count against nothing, as Grifando's reads did.
4. `rate_limit_windows` is keyed by `<rule>:<subject>`, where the subject is a Learner or a
   hashed client IP, with no reference to a Learner: the one table ADR 0003's scoping does not
   cover. Deleting a Learner leaves their windows, which the idle cleanup deletes after 2 days
   (ADR 0011), as Grifando did.
5. `CLIENT_IP_HEADER` names the header whose first entry is the client IP, `x-forwarded-for` by
   default. A deployment sets it to a header its proxy writes and a client cannot forge, such as
   Fly.io's `fly-client-ip`: a client can add its own `x-forwarded-for` entry in front of the one
   a proxy appends.
6. `IP_HASH_SALT` is read by the hosted profile only. In production the server does not start
   without it, where Grifando failed its build; elsewhere it falls back to Grifando's fixed
   development salt.

## Consequences

- `MIGRATION_PROTOCOL.md` (Phase 6) points its trusted-proxy setting here, and `AGENTS.md` lists
  the variables a hosted production server needs.
- `EdgeFailure` carries headers, so a route's tagged error can answer `Retry-After`.

## Alternatives

- Count every call before its body or key checks, in one middleware: an invalid body or a
  missing key would cost the visitor a call, and a refused call would hide the key prompt.
- Trust the last `x-forwarded-for` entry, which a single proxy appends: wrong behind two proxies,
  and still a guess where a host names its own header.
