// A Mistake Pattern rebuilt from its evidence (docs/adr/0031): the Occurrences it still has and
// the Attempts on its Exercises, replayed in the order they happened. Replaying gives the state the
// Academy builds one event at a time: an Occurrence of a Finding is a failed recall in writing
// (docs/adr/0014), a Naturalness Note grows the pattern without a recall (docs/adr/0028), and an
// Attempt moves the Mastery Level by its grade (Grifando SPEC.md §6).
import type { ExerciseType } from "@fluenshift/contract";

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

// The pattern its evidence builds, from the Occurrences in the order they were folded and the
// Attempts in the order they were made; null when no Occurrence is left.
export const replayPattern = (
  _occurrences: readonly OccurrenceEvidence[],
  _attempts: readonly AttemptEvidence[]
): ReplayedPattern | null => null;
