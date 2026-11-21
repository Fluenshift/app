# 0041. The Writing Desk's Evaluations feed the Academy once the Learner has practiced

- Status: Accepted on 2026-11-21 by the session (ADR 0020), with #271, which the audit of the
  definition of done (#270) opened.
- Implements ADR 0004, decision 2, and ADR 0014 for work-origin Writing Samples. No ledger row
  changes: ADR 0014's rows are verified through practice writing.

## Context

- ADR 0004 runs the Trainer's Enrichment over an Evaluation's Findings "only when the Academy is
  in use", and ADR 0014 makes a Finding mapped to an existing Mistake Pattern a failed recall
  "whatever the sample's origin". ADR 0020 (#119) let the Trainer receive the whole Writing
  Sample of either origin and rejected enriching practice-origin samples only.
- Only practice writing folded an Evaluation (`evaluatePractice`). `POST /api/evaluations`, the
  Writing Desk, ran the Judge alone, so a mistake in real text never reached a Mistake Pattern.
  Nothing defined when the Academy is in use.
- AR-01 (ADR 0016): Evaluation, History and Progress work without the Academy, and the Academy
  calls no model until the Learner uses it. Every Academy flow that calls a model starts from a
  practice-origin Writing Sample: practice writing, Explain code, the daily challenge and the
  Interview's answers; Exercises come from the patterns those fold.
- `foldEvaluation` reads a stored Evaluation, runs the Enrichment and folds its Findings and
  Naturalness Notes in one transaction, and refuses a second fold of the same Evaluation.
- The hosted Writing Desk already carries an OpenRouter key, which runs the Trainer too
  (ADR 0035, decision 3). The local profile's Trainer runs on its configured key, if any.

## Decision

1. The Academy is in use for a Learner once they have at least one practice-origin Evaluation.
   Until then the Writing Desk calls the Judge alone.
2. Once it is in use, the Writing Desk folds each Evaluation the Judge stored, as practice
   writing does, on the Trainer of the request: the key the request carries, else the local
   profile's configured key. With no key, the Evaluation is not enriched.
3. The fold runs after the Evaluation is stored and before the Writing Desk answers. The answer
   does not change: the Evaluation never mentions mastery (ADR 0014).
4. A failed fold, whatever its error, keeps the Evaluation and its answer. It logs one
   error-level line, `work-enrichment`, with the error's tag or name, never its message or the
   text (ADR 0026). The Evaluation stays unenriched; no route retries it.
5. The fold composes outside the Academy, beside practice writing
   (`apps/server/src/practice/work-enrichment.ts`), as `AGENTS.md` asks of code that writes both
   an Evaluation and Academy state.

## Consequences

- A mistake the Learner repeats in real text costs mastery, as Grifando's analyzed writing did.
- Once the Learner has practiced, each Writing Desk Evaluation makes one more AI call, on the
  Learner's key in the hosted profile, and answers after it. Its rate limit counts the request
  once (ADR 0033).
- Deleting a work Evaluation rebuilds the patterns it touched, as for practice (ADR 0031).
  Progress still reads work Evaluations only (ADR 0030), and the Academy's trend practice only
  (ADR 0027).
- Evaluations stored before the Learner first practiced stay unenriched.

## Alternatives

- Fold in the background after answering: a faster answer, but a fiber that outlives its
  request, a fold lost when the process stops, and tests that wait on timing.
- The Academy is in use once a Mistake Pattern exists: a first practice sample without Findings
  would leave it unused.
- A setting the Learner turns on: new state and a new screen that neither source had, where
  AR-01 already names the signal.
- Fold every work Evaluation whenever a Trainer key exists: a model call for a Learner who never
  used the Academy, against AR-01.
