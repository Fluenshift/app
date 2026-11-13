# 0006. Set input caps per deploy profile

- Status: Proposed. Decided on {issue}; accepted when both owners accept it there.
- Seam: Phase 1 (e). Ledger rows: `decision: "adr:0006"`.

## Context

- PE: at most 32 KiB of UTF-8 per Writing Sample (`MAX_WRITING_SAMPLE_BYTES`,
  `apps/server/src/evaluation/writing-evaluation.ts:36`) and a 256 KiB request body
  (`apps/server/src/app.ts:218`). Its users paste long agent prompts.
- Grifando: 5,000 characters of text, 1,000 of prompt and 2,000 of code
  (`src/app/api/writing-sessions/route.ts:16-18`), to bound abuse on a public site.

## Decision

Caps come from the deploy-profile Config and are enforced at the edge and in the service:

- `local`: PE's caps, 32 KiB per Writing Sample and a 256 KiB body.
- `hosted`: 5,000 characters of writing (and never more than 32 KiB), 1,000 of prompt text,
  2,000 of code, and a 256 KiB body.

## Consequences

- Rows `adr:0006` become `port-changed`: the same rejection behavior, with the limit read from
  Config. One test per cap and profile.

## Alternatives

- One cap for both profiles: either PE's users lose long prompts or the public site accepts
  32 KiB per request.
