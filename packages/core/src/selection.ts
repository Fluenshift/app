// Ported from Grifando src/server/domain/exercises/selection.ts; SPEC.md is Grifando's.
import { recallProbability } from "./recall";
import type { RecallState } from "./recall";

export type SelectablePattern = RecallState & {
  id: string;
  occurrenceCount: number;
};

// Review queue: the patterns the user is most likely to have forgotten come
// first (lowest estimated recall, see recall.ts), with the most frequent
// mistake first on ties. Freshly practiced and MASTERED patterns have high
// recall, so they sink — deprioritized, never excluded (SPEC.md §5.4/§6.1).
export const selectPatternsForPractice = <T extends SelectablePattern>(
  patterns: T[],
  count: number,
  now: Date
): T[] =>
  patterns
    .map((pattern) => ({ pattern, recall: recallProbability(pattern, now) }))
    .toSorted(
      (a, b) =>
        a.recall - b.recall ||
        b.pattern.occurrenceCount - a.pattern.occurrenceCount
    )
    .slice(0, count)
    .map(({ pattern }) => pattern);

// Daily-session review set: interleaves the mistakes just made (freshIds, in
// their order) with the patterns most due for review, instead of practicing one
// kind in a block. Fresh patterns take at most
// half the slots when enough due ones exist; either side fills any slots the
// other cannot.
export const selectReviewSet = <T extends SelectablePattern>(
  patterns: T[],
  count: number,
  now: Date,
  freshIds: string[]
): T[] => {
  const fresh = freshIds
    .map((id) => patterns.find((pattern) => pattern.id === id))
    .filter((pattern): pattern is T => pattern !== undefined);
  const due = selectPatternsForPractice(
    patterns.filter((pattern) => !freshIds.includes(pattern.id)),
    count,
    now
  );

  const freshSlots = Math.min(
    fresh.length,
    Math.max(Math.ceil(count / 2), count - due.length)
  );
  const chosenFresh = fresh.slice(0, freshSlots);
  const chosenDue = due.slice(0, count - chosenFresh.length);

  const interleaved: T[] = [];
  for (
    let i = 0;
    interleaved.length < chosenFresh.length + chosenDue.length;
    i += 1
  ) {
    // Neither list holds undefined, so a read is undefined exactly when i is past
    // that list's end: the same test as Grifando's `i < list.length`.
    const freshPattern = chosenFresh[i];
    const duePattern = chosenDue[i];
    if (freshPattern !== undefined) {
      interleaved.push(freshPattern);
    }
    if (duePattern !== undefined) {
      interleaved.push(duePattern);
    }
  }
  return interleaved;
};
