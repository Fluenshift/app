# 0028. The natural version and the Naturalness Notes of the Enrichment

- Status: Accepted on 2026-11-20 by the session (ADR 0020).
- Phase 5. Builds AR-03 and AR-04 for the "correct but unnatural" channel of ADR 0004, with the
  answer ADR 0020 gave #101. No ledger row changes: Grifando `SPEC.md` §5.1 and §6 are
  superseded by the merged documents (ADR 0022), and no Grifando test covers the `UNNATURAL`
  severity.

## Context

- Grifando's writing analysis returned three tiers of writing quality: errors, "correct but
  unnatural" mistakes with the `UNNATURAL` severity, and a separate `naturalText`, "a more natural
  rendering of the same idea" (`src/server/ai/prompts/writingAnalysis.ts`, 74dbb9f). It stored the
  natural text with the analysis and folded every mistake, unnatural or not, as a failed recall
  (`src/server/domain/writing/writingCoachService.ts`). Its results showed a "Natural version"
  beside the corrected version, and its interview feedback a "More naturally" block when the
  natural text differed from the answer.
- ADR 0004 gives the natural version and the unnatural spans to the Trainer's Enrichment, as
  Naturalness Notes that never change the score, the corrected text or the Finding Rate. ADR 0020
  decided that a note grows its Mistake Pattern's occurrence count and is never a failed recall.
- The ported Enrichment added only the Findings' Academy fields, and it skipped the Trainer when
  no Finding could form a Mistake Pattern (Clarity and Other have no Mistake Category, ADR 0005).

## Decision

1. The Enrichment runs on every Evaluation it folds, with or without Findings that form a Mistake
   Pattern: the natural version and the notes need none. The Trainer answers the Findings' entries,
   the natural version, and the notes, at most 50, with Grifando's bounds.
2. A Naturalness Note has an original span, a natural span, an explanation, an example, a Pattern
   Key and the L1 Transfer flag. Its Mistake Category is always the unnatural-phrasing one, so the
   Trainer is never offered a category for it.
3. A note grows its pattern as an error does: one more Occurrence, the last seen time, and the
   canonical example. It is not a recall event: it leaves the incorrect count, the time of the
   last recall and the Mastery Level as they were. A pattern a note creates starts with no
   incorrect recall.
4. Each note is an Occurrence without a Finding, after the Findings' Occurrences, in the
   Trainer's order. Notes are not marked in the text: only Findings have located spans
   (ADR 0004, decision 4).
5. The Enrichment record keeps the natural version. A practice writing answer and an interview
   answer carry it; it is null only for an Enrichment recorded before this decision.
6. The Academy's results show the natural version beside the corrected version, with Grifando's
   copy, and an interview turn's feedback shows it as "More naturally" when it differs from the
   answer, as Grifando did. Each note shows as Grifando's card, labeled "Unnatural".

## Consequences

- One Trainer call per practice Writing Sample, as Grifando made one analysis call per text, even
  when the Judge finds nothing to fold.
- A pattern grown only by notes can enter practice, but its Mastery Level and Recall move only
  through Attempts.
- `DATA-POLICY.md` lists the natural version and the notes among what the Academy stores.

## Alternatives

- Ask the Trainer only when a Finding forms a Mistake Pattern: no call for a text the Judge found
  clean, and no natural version or note for it either.
- Count a note as a recall event that is neither correct nor incorrect, moving the time of the
  last recall: the half-life model has no such event, and ADR 0020 names a note "never a failed
  recall".
- Locate the notes' spans and mark them in the text like Findings: the Trainer's spans are not
  validated offsets, and Grifando's `indexOf` highlights are the bug ADR 0004 fixes.
