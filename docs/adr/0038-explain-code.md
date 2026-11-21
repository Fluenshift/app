# 0038. Explain code is practice writing with a snippet only the Trainer receives

- Status: Accepted on 2026-11-20 by the session (ADR 0020), with the Phase 6 Explain code unit
  (#242).
- Phase 6, requirement HR-02. Ledger rows in `academy-http.json`: the two cases of
  `grifando:characterization:src/app/api/writing-sessions/codeSnippet.characterization.test.ts`,
  written with this unit, are `port-changed` under this ADR. Grifando's page and
  `ExplainCodeCoach` have no test at the baseline and port from source (ADR 0025, decision 5).

## Context

- Grifando's Explain code page sent the Learner's explanation and a code snippet to
  `POST /api/writing-sessions` with the prompt type `EXPLAIN_CODE`. The route trimmed the snippet,
  refused a blank one or one over 2,000 characters with its validation issues, and the analysis
  received it as context; the session never stored it (`writingCoachService.test.ts`). No source
  test sent a snippet through the route; this unit characterized it.
- Practice writing replaced the writing session route (ADR 0026), and `foldEvaluation` already
  passes a snippet to the Trainer's Enrichment and stores none (`academy-persistence`, ADR 0004).
  The Judge evaluates the Writing Sample alone.
- `InputLimits.codeMaxCharacters` is 2,000 in the hosted profile and none in the local profile
  (ADR 0006), and nothing read it. HR-02 wants each cap at the edge and in the service.
- The SPA sizes its writing sheets from `GET /api/sample-limits` (`SampleLimits`), which had no
  code cap. Grifando's screen fixed 2,000 characters.
- ADR 0034 left Explain code out of the Academy navigation until its screen existed.

## Decision

1. `POST /api/practice-writing` takes an optional `codeSnippet` beside the Writing Sample:
   trimmed, never blank, and within the Deploy Profile's code cap, or 400 with the validation
   issues as Grifando answered. The route builds that check from its profile's caps.
2. The snippet reaches only the Trainer, through `foldEvaluation`, and is never stored or logged.
   The Judge evaluates the explanation alone.
3. `evaluatePractice` checks the snippet against the cap of the Deploy Profile its runtime names,
   before the Judge runs, and refuses one over it with `InvalidWritingSampleError`.
4. `SampleLimits` gains `codeMaxCharacters`, null when the profile caps no code, and the code
   sheet of `/explain-code` takes its cap from it, as the other sheets take theirs.
5. `/explain-code` renders Grifando's page and `ExplainCodeCoach`: two sheets, feedback once both
   hold text, the practice writing results, and "Write something else" clearing both. A failure
   keeps both sheets and shows the key notice or the route's message, as `/write` does.
6. The Academy navigation lists Explain code after Technical, as Grifando's did.

## Consequences

- The local profile takes a snippet of any length, bounded only by the 256 KiB request body.
- Every fixture of `SampleLimits` names the code cap.
- An interview answer still carries no snippet.

## Alternatives

- Grifando's fixed 2,000 characters in the screen: the local profile would cap in the browser
  what its server accepts.
- A route of its own for Explain code: it would repeat practice writing's admission, failures
  and results for one more field.
