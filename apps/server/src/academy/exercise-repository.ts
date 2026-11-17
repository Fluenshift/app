// The Learner's Exercises and their Attempts. Ported from Grifando
// src/server/domain/exercises/exercise.repository.ts and exerciseAttempt.repository.ts
// (74dbb9f): another Learner's Exercise or Attempt reads as not found.
import { randomUUID } from "node:crypto";

import type { ExerciseType, GeneratedExercise } from "@fluenshift/contract";
import { Database, exerciseAttempts, exercises } from "@fluenshift/db";
import { and, asc, eq, notExists } from "drizzle-orm";
import { Effect } from "effect";

import { CurrentLearner } from "../learner-identity";

export interface Exercise {
  readonly createdAt: Date;
  // Target difficulty 1 to 5 requested from the generator.
  readonly difficulty: number | null;
  readonly id: string;
  // The Trainer model that generated it (docs/adr/0012).
  readonly model: string;
  readonly promptData: GeneratedExercise;
  readonly sourcePatternId: string | null;
  readonly type: ExerciseType;
}

export interface Attempt {
  readonly attemptedAt: Date;
  readonly exerciseId: string;
  readonly feedback: string;
  readonly id: string;
  readonly isCorrect: boolean;
  readonly learnerAnswer: string;
}

export interface CreateExerciseInput {
  readonly difficulty: number;
  readonly model: string;
  readonly promptData: GeneratedExercise;
  readonly sourcePatternId: string;
  readonly type: ExerciseType;
}

export interface CreateAttemptInput {
  readonly exerciseId: string;
  readonly feedback: string;
  readonly isCorrect: boolean;
  readonly learnerAnswer: string;
}

// The prompt data is the generated Exercise as the Trainer's schema accepted it.
const toExercise = (row: typeof exercises.$inferSelect): Exercise => ({
  createdAt: row.createdAt,
  difficulty: row.difficulty,
  id: row.id,
  model: row.model,
  promptData: row.promptData as GeneratedExercise,
  sourcePatternId: row.sourcePatternId,
  type: row.type as ExerciseType,
});

const toAttempt = (row: typeof exerciseAttempts.$inferSelect): Attempt => ({
  attemptedAt: row.attemptedAt,
  exerciseId: row.exerciseId,
  feedback: row.feedback,
  id: row.id,
  isCorrect: row.isCorrect,
  learnerAnswer: row.learnerAnswer,
});

// All of them or none, in the order given.
export const createExercises = Effect.fn("ExerciseRepository.createExercises")(
  function* (inputs: readonly CreateExerciseInput[]) {
    if (inputs.length === 0) {
      return [];
    }
    const database = yield* Database;
    const learner = yield* CurrentLearner;
    const rows = yield* database.run((client) =>
      client
        .insert(exercises)
        .values(
          inputs.map((input) => ({
            ...input,
            id: randomUUID(),
            learnerId: learner.id,
          }))
        )
        .returning()
    );
    return rows.map(toExercise);
  }
);

// The Learner's Exercises without an Attempt, oldest first (Grifando's listPending).
export const listPendingExercises = Effect.fn(
  "ExerciseRepository.listPendingExercises"
)(function* () {
  const database = yield* Database;
  const learner = yield* CurrentLearner;
  const rows = yield* database.run((client) =>
    client
      .select()
      .from(exercises)
      .where(
        and(
          eq(exercises.learnerId, learner.id),
          notExists(
            client
              .select({ id: exerciseAttempts.id })
              .from(exerciseAttempts)
              .where(eq(exerciseAttempts.exerciseId, exercises.id))
          )
        )
      )
      .orderBy(asc(exercises.createdAt))
  );
  return rows.map(toExercise);
});

export const findExercise = Effect.fn("ExerciseRepository.findExercise")(
  function* (id: string) {
    const database = yield* Database;
    const learner = yield* CurrentLearner;
    const [row] = yield* database.run((client) =>
      client
        .select()
        .from(exercises)
        .where(and(eq(exercises.learnerId, learner.id), eq(exercises.id, id)))
    );
    return row === undefined ? null : toExercise(row);
  }
);

export const createAttempt = Effect.fn("ExerciseRepository.createAttempt")(
  function* (input: CreateAttemptInput) {
    const database = yield* Database;
    const learner = yield* CurrentLearner;
    const [row] = yield* database.run((client) =>
      client
        .insert(exerciseAttempts)
        .values({ ...input, id: randomUUID(), learnerId: learner.id })
        .returning()
    );
    if (row === undefined) {
      return yield* Effect.die(new Error("The insert returned no Attempt"));
    }
    return toAttempt(row);
  }
);

// An Attempt with its Exercise, scoped to that Exercise and its Learner, so an id from another
// Learner, or from another Exercise, reads as not found.
export const findAttempt = Effect.fn("ExerciseRepository.findAttempt")(
  function* (input: {
    readonly attemptId: string;
    readonly exerciseId: string;
  }) {
    const database = yield* Database;
    const learner = yield* CurrentLearner;
    const [row] = yield* database.run((client) =>
      client
        .select()
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
            eq(exerciseAttempts.learnerId, learner.id),
            eq(exerciseAttempts.id, input.attemptId),
            eq(exerciseAttempts.exerciseId, input.exerciseId)
          )
        )
    );
    return row === undefined
      ? null
      : {
          ...toAttempt(row.exercise_attempts),
          exercise: toExercise(row.exercises),
        };
  }
);
