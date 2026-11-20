# 0026. Practice writing: its route, its results, and the logs of unexpected failures

- Status: Accepted on 2026-11-20 by the session (ADR 0020).
- Phase 5e. Amends ADR 0024 for practice writing. Ledger rows: the two rows of Grifando's
  `noKeyInLogs.test.ts` (`academy-trainer`), which stay `port`. No disposition changes.

## Context

- Grifando's `WritingCoach` posted `{ promptType, promptText, technicalCategory, originalText,
  retrySessionId }` to `POST /api/writing-sessions`, which answered 201 with the analyzed session,
  or 201 with a FAILED session and a message when the analysis failed (74dbb9f). ADR 0004 retired
  that analysis: practice text is a practice-origin Writing Sample that the Judge evaluates, and
  the Trainer's Enrichment folds its Findings (`evaluatePractice`,
  `apps/server/src/practice/practice-writing.ts`).
- An Evaluation records no Practice Prompt. Grifando kept the prompt on its writing session and
  sent it to the analysis call, which ADR 0004 retired; the Judge never sees it, and the
  Enrichment works from Findings.
- Grifando's `WritingResults` showed the text with numbered marks, one `MistakeCard` per
  occurrence (Mistake Category, the Portuguese flag, the correction, the explanation, an example,
  "Save to vocabulary"), four model scores, the corrected version and the natural version. ADR 0002
  removed the scores, ADR 0004 replaced the marks with PE's localization, and the natural version
  waits for the Naturalness Notes (ADR 0020).
- Grifando's routes log `logError(context, error)` before each generic 500: the context and the
  error's name, message and code. The ported Academy routes log nothing (#149). An SDK error can
  carry the request's headers, and so a Learner's key, and a database error's message can quote SQL
  parameters, and so Learner text.

## Decision

1. `POST /api/practice-writing` takes `{ writingSample }`, checked by the Evaluation route's
   schema and limits. It resolves the Trainer key before anything else, then runs
   `evaluatePractice`. It answers 201 `{ status: "evaluated", evaluation, occurrences }` with the
   Occurrences the Enrichment recorded, or 201 `{ status: "failed", evaluationId, message }` with
   Grifando's message when the Enrichment fails and the Evaluation stands. A Judge failure answers
   as the Evaluation route does, an access error of the Trainer by its code (ADR 0024), and
   anything else with Grifando's generic 500. The 201 of a failed Enrichment keeps Grifando's
   status for its FAILED session; the interview's 200 stays its own (ADR 0024).
2. A practice Writing Sample records no Practice Prompt: the request carries only the text. The
   dashboard's recent writing shows no prompt label.
3. The Academy shows a practice Evaluation in Grifando's results structure: the text with PE's
   localized marks (`SpellChecker`, read-only), the Overall Score with its Proficiency Band and
   summary in place of the four scores, one note per Occurrence as Grifando's `MistakeCard` (the
   correction, the Mistake Category, the L1 Transfer flag as "From Portuguese", the explanation,
   the example, and "Save to vocabulary" through history state, ADR 0025), the corrected version,
   and a link to the Evaluation's own page. The natural version joins with the Naturalness Notes.
4. An unexpected failure of an Academy route, one its edge answers with the generic 500, logs one
   error-level line through Effect's logger: the route's context and the error's tag or name, never
   its message, code or other properties.

## Consequences

- The `noKeyInLogs.test.ts` rows port onto the practice writing route: a Trainer that dies while
  enriching leaves the Evaluation and answers 201, and a Trainer that cannot be built answers 500
  and logs, with no key in any log line.
- `makeEdge` takes the route's log context, and each Academy route names one, after Grifando's
  `logError` contexts in this repository's vocabulary.
- A log line no longer says why a route failed beyond the error's tag or name; the cause stays in
  the Effect's own trace.

## Alternatives

- Record the Practice Prompt in an Academy table beside the Evaluation: the dashboard could label
  recent writing, at the cost of a migration and a new retained field in `DATA-POLICY.md`.
- Show the practice Evaluation with PE's Evidence Lens: one rendering for both axes, but ADR 0009
  keeps Grifando's page structure on Academy screens.
- Log the error's message, as Grifando did: more to debug with, but a database error's message can
  carry Learner text.
