# 0011. Run hosted-profile cleanup inside the server process

- Status: Proposed. Decided on [#5](https://github.com/Fluenshift/app/issues/5); accepted when both owners accept it there.
- Seam: Phase 1 (j). Ledger rows: `decision: "adr:0011"`.

## Context

Grifando deletes users idle for 90 days and old rate-limit windows from `/api/cron/cleanup`,
called daily by Vercel cron with a `CRON_SECRET` bearer (`vercel.json`). The product runs as
one process in a container, without Vercel cron.

## Decision

In the hosted profile the server runs the cleanup once a day on an Effect `Schedule`, in
process. There is no public cleanup endpoint, so there is no bearer secret to leak. The local
profile runs no cleanup: data stays until the learner deletes it.

## Consequences

- Rows `adr:0011`: the cron route's bearer checks become `superseded`; the cleanup rules (90
  days, rate-limit windows older than 2 days) `port`.

## Alternatives

- Keep the endpoint and use the host's scheduler: works on any platform with cron, but keeps a
  secret-protected public endpoint.
