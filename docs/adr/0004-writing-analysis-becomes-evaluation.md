# 0004. Grifando's writing analysis becomes Evaluation plus Trainer enrichment

- Status: Proposed. Decided on {issue}; accepted when both owners accept it there.
- Seam: Phase 1 (c), with Grifando #78. Ledger rows: `decision: "adr:0004"`.

## Context

- Grifando's Writing Coach sends text to its own analysis call. It returns mistakes (category,
  `patternKey`, original and corrected spans, explanation, L1 flag), a natural version and
  scores (`src/server/ai/schemas/writingAnalysis.ts`), then folds the mistakes into patterns
  (`src/server/domain/writing/writingCoachService.ts`).
- PE's Evaluation sends text to the pinned Judge and stores Findings with validated byte-offset
  spans under Rubric Version 1.
- PRE_MIGRATION seam rules: the Academy only reads Findings; one fixed Judge per Rubric Version;
  "correct but unnatural" becomes a separate per-span channel; `patternKey` and Grifando's
  finer categories are a pedagogical sublevel.
- Grifando #78: highlights found with `indexOf` mark the wrong place when the span repeats
  (`src/lib/highlightSegments.ts:11`).

## Decision

1. All learner text goes through the Evaluation (Judge). Grifando's analysis call is retired.
2. The Academy fields, `patternKey`, the finer category, `l1Transfer`, the natural version and
   examples, come from a separate Trainer enrichment call over an Evaluation's Findings. It
   runs only when the Academy is in use. The Judge contract and Rubric Version 1 stay as they
   are.
3. "Correct but unnatural" notes come from the enrichment as a separate per-span channel; they
   never change the score, the corrected text or Finding Rate.
4. Spans are located by validated byte offsets and re-anchored only when unique (PE
   `assessment-localization.ts`), which fixes #78.
5. A failed Evaluation stores nothing and keeps the draft (QR-03). It supersedes Grifando's
   reuse of a failed writing session on retry (#4, commits 218b7b7 and 032c115).

## Consequences

- Rows `adr:0004`: the analysis prompt, schema and provider `analyzeWriting` rows become
  `superseded`; pattern folding becomes `port-changed` (input: Findings plus enrichment); the
  highlight rows are `superseded` by PE's localization; SPEC §5.1 becomes `port-changed`.
- One extra AI call per Evaluation while the Academy is in use, on any Trainer provider
  (ADR 0012).

## Alternatives

- Extend the Judge contract to return the Academy fields in the same call. Cheaper per
  submission, but it creates a new Rubric Version for every Evaluation and couples the Academy
  to the Judge.
