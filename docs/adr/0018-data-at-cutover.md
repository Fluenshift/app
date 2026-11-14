# 0018. Start Grifando's hosted data fresh; import PE's local history

- Status: Proposed. Decided on [#5](https://github.com/Fluenshift/app/issues/5); accepted when both owners accept it there.
- Phase 7 step 5. No ledger row waits on it; it fixes the cutover plan early.

## Context

- Phase 7 makes carrying data over optional, then archives both apps. Without a plan, cutover
  is either an unannounced fresh start or a loss of learner data.
- Grifando's data belongs to anonymous sessions: a signed cookie on `grifando.vercel.app`,
  verified with that deployment's `SESSION_SECRET`. A product on another host cannot read
  those cookies, so learners could not reach imported data anyway.
- Grifando's stored analyses carry model-supplied scores and its own categories, which the
  product no longer uses (ADR 0002, 0004, 0005).
- PE's history is one learner's local SQLite file, scored under Rubric Version 1.

## Decision

1. Grifando: fresh start. For at least 30 days before cutover the old site shows the date and
   what happens to the data; "Delete my data" keeps working. After cutover the old database is
   kept read-only for 30 days, then deleted.
2. PE: a one-time importer copies local Evaluations into the product as Rubric Version 1,
   never merged with the provisional version in Progress. It runs in dry-run mode first and
   reports counts, and the import is accepted only when counts match.

## Consequences

- Phase 7 step 5 stops being optional: the notice, the read-only window and the importer are
  cutover criteria.

## Alternatives

- Import Grifando's data: needs the product on Grifando's domain with the same session secret,
  plus a mapping of rescored analyses; costly for anonymous, mostly short-lived sessions.
- Fresh start for PE too: Jhefferson loses his own Rubric Version 1 history.
