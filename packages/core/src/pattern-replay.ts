// A Mistake Pattern rebuilt from its evidence (docs/adr/0031): the Occurrences it still has and
// the Attempts on its Exercises, replayed in the order they happened. Replaying gives the state the
// Academy builds one event at a time: an Occurrence of a Finding is a failed recall in writing
// (docs/adr/0014), a Naturalness Note grows the pattern without a recall (docs/adr/0028), and an
// Attempt moves the Mastery Level by its grade (Grifando SPEC.md §6).
import { MasteryLevel } from "@fluenshift/contract";
import type { ExerciseType } from "@fluenshift/contract";

import { applyExerciseResult } from "./mastery";
import type { MasteryState } from "./mastery";

export interface OccurrenceEvidence {
  readonly at: Date;
  readonly correctedSpan: string;
  // An Occurrence of a Finding, which is a failed recall; a Naturalness Note's is not.
  readonly isFinding: boolean;
  readonly originalSpan: string;
}

export interface AttemptEvidence {
  readonly at: Date;
  readonly exerciseType: ExerciseType;
  readonly isCorrect: boolean;
}

export interface ReplayedPattern extends MasteryState {
  readonly correctCount: number;
  readonly exampleCorrection: string;
  readonly exampleOriginal: string;
  readonly firstSeenAt: Date;
  readonly incorrectCount: number;
  readonly lastPracticedAt: Date;
  readonly lastSeenAt: Date;
  readonly occurrenceCount: number;
}

// A new pattern's state, before its first recall.
const UNPRACTICED: MasteryState = {
  consecutiveCorrectCount: 0,
  masteryLevel: MasteryLevel.ACTIVE,
};

// One recall event, a failed recall in writing or an Attempt, in time order: an Occurrence comes
// before an Attempt of the same moment, and each keeps its place in its own list.
interface RecallEvent {
  readonly at: Date;
  readonly exerciseType?: ExerciseType;
  readonly isCorrect: boolean;
  readonly rank: number;
}

const latest = (dates: readonly Date[]) =>
  new Date(Math.max(...dates.map((date) => date.getTime())));

// The pattern its evidence builds, from the Occurrences in the order they were folded and the
// Attempts in the order they were made; null when no Occurrence is left.
export const replayPattern = (
  occurrences: readonly OccurrenceEvidence[],
  attempts: readonly AttemptEvidence[]
): ReplayedPattern | null => {
  const [first] = occurrences;
  const last = occurrences.at(-1);
  if (first === undefined || last === undefined) {
    return null;
  }
  const failedInWriting = occurrences.filter(
    (occurrence) => occurrence.isFinding
  );
  const recalls: readonly RecallEvent[] = [
    ...failedInWriting.map((occurrence, index) => ({
      at: occurrence.at,
      isCorrect: false,
      rank: index,
    })),
    ...attempts.map((attempt, index) => ({
      at: attempt.at,
      exerciseType: attempt.exerciseType,
      isCorrect: attempt.isCorrect,
      rank: failedInWriting.length + index,
    })),
  ].toSorted(
    (left, right) =>
      left.at.getTime() - right.at.getTime() || left.rank - right.rank
  );
  let mastery = UNPRACTICED;
  for (const recall of recalls) {
    mastery = applyExerciseResult(
      mastery,
      recall.isCorrect,
      recall.exerciseType
    );
  }
  const correctCount = attempts.filter((attempt) => attempt.isCorrect).length;
  return {
    ...mastery,
    correctCount,
    exampleCorrection: last.correctedSpan,
    exampleOriginal: last.originalSpan,
    firstSeenAt: first.at,
    incorrectCount: recalls.length - correctCount,
    lastPracticedAt: latest([first.at, ...recalls.map((recall) => recall.at)]),
    lastSeenAt: last.at,
    occurrenceCount: occurrences.length,
  };
};
