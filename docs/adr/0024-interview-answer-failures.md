# 0024. How an interview answer fails

- Status: Accepted on 2026-11-20 by the session (ADR 0020).
- Amends ADR 0010 for the interview answer route. Ledger rows: the `adr:0010` rows of
  `interview.characterization.test.ts`; no disposition changes.

## Context

Grifando analyzed an interview answer in one call. An access error (key, quota, availability)
reached the route by its code; any other failure left a FAILED writing session with the text and
answered 200 `{ status: "failed", message, sessionId }`, and the Learner retried with
`retrySessionId`, which re-analyzed that session instead of creating another. Under ADR 0010 the
answer is a practice Writing Sample: the Judge evaluates it, then the Trainer's Enrichment folds
its Findings into Mistake Patterns. The Judge records nothing when it fails, and an Evaluation
cannot be evaluated again in place.

## Decision

- A Judge failure answers as the Evaluation route does (`FAILURE_STATUS`, `{ kind, code,
  retryable }`, or 422 for no English) and records nothing.
- An access error of the Trainer answers by its code, as in Grifando.
- Any other Enrichment failure keeps the Evaluation and answers 200 `{ status: "failed",
  evaluationId, message }` with Grifando's message: the Evaluation is the FAILED writing session.
- In each case the turn stays open, and the Learner posts the answer again. `retrySessionId` is
  gone; the retried answer is a new Evaluation.

## Consequences

- The ported failure case asserts `evaluationId` where Grifando asserted `sessionId`.
- An Enrichment that failed leaves an Evaluation whose Findings no Mistake Pattern counts. A later
  unit may retry the fold of that Evaluation alone, which `foldEvaluation` allows.

## Alternatives

- Fold after the turn is answered and ignore an Enrichment failure: the interview never stalls,
  but the failure is silent.
- Port `retrySessionId` as `retryEvaluationId`, folding that Evaluation again instead of
  evaluating the answer: no second Evaluation, but a retry path that no source test covers.
