// Unfolding an Evaluation, the inverse of folding it (pattern-folding.ts), when the Learner deletes
// it (docs/adr/0031, DATA-POLICY.md § Deletion). The Evaluation's Occurrences go, and each Mistake
// Pattern they touched is rebuilt from the Occurrences and the Attempts that remain. A pattern left
// without an Occurrence goes too; the Learner's Exercises and Attempts stay.
import type { ExerciseType, LearnerId } from "@grifando/contract";
import { replayPattern } from "@grifando/core/pattern-replay";
import {
  exerciseAttempts,
  exercises,
  mistakePatterns,
  occurrences,
} from "@grifando/db";
import type { DrizzleClient } from "@grifando/db";
import { and, asc, eq } from "drizzle-orm";

// The pattern's Occurrences in the order they were folded: by moment, then a fold's Findings in
// their order, then its notes in theirs.
const occurrencesOf = (
  client: DrizzleClient,
  learnerId: LearnerId,
  patternId: string
) =>
  client
    .select({
      at: occurrences.createdAt,
      correctedSpan: occurrences.correctedSpan,
      findingPosition: occurrences.findingPosition,
      originalSpan: occurrences.originalSpan,
    })
    .from(occurrences)
    .where(
      and(
        eq(occurrences.learnerId, learnerId),
        eq(occurrences.patternId, patternId)
      )
    )
    .orderBy(
      asc(occurrences.createdAt),
      asc(occurrences.findingPosition),
      asc(occurrences.notePosition)
    );

// The Attempts on the pattern's Exercises, in the order they were made.
const attemptsOn = (
  client: DrizzleClient,
  learnerId: LearnerId,
  patternId: string
) =>
  client
    .select({
      at: exerciseAttempts.attemptedAt,
      exerciseType: exercises.type,
      isCorrect: exerciseAttempts.isCorrect,
    })
    .from(exerciseAttempts)
    .innerJoin(
      exercises,
      and(
        eq(exercises.learnerId, exerciseAttempts.learnerId),
        eq(exercises.id, exerciseAttempts.exerciseId)
      )
    )
    .where(
      and(
        eq(exercises.learnerId, learnerId),
        eq(exercises.sourcePatternId, patternId)
      )
    )
    .orderBy(asc(exerciseAttempts.attemptedAt));

// One pattern rebuilt from its remaining evidence, or removed when no Occurrence is left. Its
// Exercises then lose their pattern and keep their Attempts.
const rebuildPattern = (
  client: DrizzleClient,
  learnerId: LearnerId,
  patternId: string
) =>
  Promise.all([
    occurrencesOf(client, learnerId, patternId),
    attemptsOn(client, learnerId, patternId),
  ]).then(([occurrenceRows, attemptRows]) => {
    const replayed = replayPattern(
      occurrenceRows.map((row) => ({
        at: row.at,
        correctedSpan: row.correctedSpan,
        isFinding: row.findingPosition !== null,
        originalSpan: row.originalSpan,
      })),
      attemptRows.map((row) => ({
        at: row.at,
        exerciseType: row.exerciseType as ExerciseType,
        isCorrect: row.isCorrect,
      }))
    );
    const pattern = and(
      eq(mistakePatterns.learnerId, learnerId),
      eq(mistakePatterns.id, patternId)
    );
    return replayed === null
      ? client.delete(mistakePatterns).where(pattern)
      : client.update(mistakePatterns).set(replayed).where(pattern);
  });

// Rebuilds the patterns one after the other.
const rebuildInOrder = (
  client: DrizzleClient,
  learnerId: LearnerId,
  patternIds: readonly string[]
): Promise<void> => {
  const [next, ...rest] = patternIds;
  if (next === undefined) {
    return Promise.resolve();
  }
  return rebuildPattern(client, learnerId, next).then(() =>
    rebuildInOrder(client, learnerId, rest)
  );
};

// Removes the Evaluation's Occurrences and rebuilds each Mistake Pattern they touched from what
// remains. Runs inside the transaction that deletes the Evaluation, whose Enrichment goes with it
// (its foreign key cascades); another Learner's Evaluation touches nothing.
export const unfoldEvaluation = (
  client: DrizzleClient,
  learnerId: LearnerId,
  evaluationId: string
): Promise<void> =>
  client
    .delete(occurrences)
    .where(
      and(
        eq(occurrences.learnerId, learnerId),
        eq(occurrences.evaluationId, evaluationId)
      )
    )
    .returning({ patternId: occurrences.patternId })
    .then((deleted) =>
      rebuildInOrder(client, learnerId, [
        ...new Set(deleted.map((occurrence) => occurrence.patternId)),
      ])
    );
