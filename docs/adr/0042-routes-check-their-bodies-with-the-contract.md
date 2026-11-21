# 0042. Each route checks its JSON body with its contract schema and declares it to the typed client

- Status: Accepted on 2026-11-21 by the session (ADR 0020), with #277, which the audit of the
  definition of done (#270) opened.
- Amends ADR 0000 (the validation and AI rows) and carries out ADR 0007 for request bodies. No
  ledger row changes.

## Context

- ADR 0000 names `@hono/standard-validator` at the edge, and ADR 0007 keeps the Effect Schema of
  every API request in `packages/contract`, so that drift between client and server fails the
  build. No package imported the validator: each route read its body itself, two request schemas
  lived in `apps/server/src/app.ts`, and Hono's typed client took any body, so a misspelled key
  compiled.
- Hono's JSON validator, which `@hono/standard-validator` runs, reads a body only when its media
  type is JSON and checks `{}` otherwise, and answers a body that is not JSON with a 400 of its
  own. PE's and Grifando's routes read the body whatever its media type, and each route answers
  a body that is not JSON as its source did: PE's Evaluation route and the evidence route with
  their one refusal, Grifando's routes as an empty or an absent body. Route tests send JSON
  without a media type and pin those refusals.
- A validator is middleware, so it runs before the route's own first check, the boundary that
  makes the route available.

## Decision

1. Each route that reads a JSON body reads it itself, after its own first checks, and checks it
   with the standard form of its contract schema (`readBody` in `apps/server/src/app.ts`). Its
   answers stay as they were.
2. The route declares the body to Hono's typed client through its context type, from the same
   contract schema (`BodyContext`): the client sends the schema's encoded side. `readBody` takes
   only a schema with the sides the context declares, or `tsc` fails, so the declared body and
   the checked body cannot drift apart.
3. Every request schema lives in `packages/contract`: `WritingSampleRequest` and
   `PracticeWritingRequest` move there, and the server adds the Deploy Profile's code cap to
   `CodeSnippet` (ADR 0038).
4. `@hono/standard-validator` and `@ai-sdk/openai`, which no package imports, leave the catalog.

## Consequences

- A client body of another shape than the contract's, a misspelled key among them, fails `tsc`
  in `apps/web`. `apps/web/src/api-bodies.test.ts` pins each body type to its contract schema.
- The typed client sends the bodies of routes with path parameters as JSON too, so `api.ts` no
  longer builds them by hand.
- A new route that reads a body takes its context as `BodyContext` and reads it with `readBody`
  and a contract schema.

## Alternatives

- `@hono/standard-validator`, as ADR 0000 named it: the same typing, but a body without a JSON
  media type would be refused and a body that is not JSON would get Hono's 400, changing the
  answers the route tests pin, and the check would run before a route's own first check.
- Hono's `validator` with a check of our own: the same media type rule and the same answer.
- Amend ADR 0000 and ADR 0007 to the old shape: drift between client and server would compile.
