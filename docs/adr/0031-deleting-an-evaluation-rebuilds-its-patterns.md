# 0031. Deleting an Evaluation rebuilds the Mistake Patterns it touched

- Status: Accepted on 2026-11-20 by the session (ADR 0020). Decision 1 amended the same day after
  the Phase 5f review (#211), to state what a rebuild keeps when the deleted Evaluation created the
  pattern.
- Phase 5f, the seam invariant "deleting an Evaluation removes the Academy state derived from
  it". No ledger row changes: PE deletes Evaluations but has no Academy, and Grifando never
  deletes a single writing session.

## Context

- Deleting an Evaluation already removed its Occurrences and its Enrichment record, through
  their foreign keys, but `DATA-POLICY.md` (Deletion) said that a Mistake Pattern still kept its
  counts and its example, and left removing them to Phase 5f.
- A pattern is grown one event at a time: an Occurrence of a Finding is a failed recall that adds
  to the incorrect count, moves the time of the last recall and may demote the Mastery Level
  (ADR 0014); a Naturalness Note adds an Occurrence and moves the example and the last seen time,
  never a recall (ADR 0028); an Attempt on one of the pattern's Exercises moves the Mastery Level
  and the recall counters. The stored pattern keeps only the totals, so subtracting a deleted
  Evaluation's share cannot undo a demotion that later Attempts built on.
- Exercises are written by the Trainer from a pattern's example, and Attempts are the Learner's
  own answers. Category Ability and the Streak are built from Attempts.

## Decision

1. In the transaction that deletes the Evaluation, the Academy removes its Occurrences and
   rebuilds each pattern they belonged to by replaying what remains, in the order it happened:
   the pattern's other Occurrences and the Attempts on its Exercises. The counts, the canonical
   example, the first and last seen times, the time of the last recall and the Mastery Level are
   what that evidence builds. When the pattern was first seen before the deleted Evaluation, that
   is the pattern as if the Evaluation had never been folded. When the deleted Evaluation created
   it, the pattern is first seen at its earliest remaining Occurrence, and the Attempts made
   before that still count (decision 3).
2. A pattern left without an Occurrence is removed: nothing the Learner still keeps shows the
   mistake.
3. Exercises and Attempts stay, and so do Category Ability and the Streak: they record practice
   the Learner did. An Exercise whose pattern is removed keeps its Attempts and loses its pattern.
4. Each Occurrence records the moment of its fold and each Attempt the moment that it records on
   its pattern, so a replay gets the same times back.
5. Learning History's delete calls the Academy's rebuild, so no path deletes an Evaluation
   without it. The Academy writes only its own tables (the Phase 5f seam).

## Consequences

- `DATA-POLICY.md` (Deletion) says what deleting an Evaluation now removes and rebuilds.
- Deleting an Evaluation costs one replay per pattern it touched: a read of that pattern's
  Occurrences and Attempts.

## Alternatives

- Subtract the deleted Evaluation's Occurrences from the counts and keep the Mastery Level: a
  demotion caused by the deleted text would outlive it.
- Remove the Exercises written while the deleted text was a pattern's example: the Learner's
  Attempts, their Category Ability and their Streak would change after the fact, and an Exercise
  does not record which example it was written from.
