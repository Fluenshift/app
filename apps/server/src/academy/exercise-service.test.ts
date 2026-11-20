// Ported from Grifando src/server/domain/exercises/exerciseService.test.ts (74dbb9f). Each case
// runs on a fresh PGlite database for the local Learner: Prisma's creates and reads become
// Drizzle queries, the AI provider becomes a fake Trainer whose calls answer Effects, and a user
// id becomes the Learner the request acts for.
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";

import { MasteryLevel, MistakeCategory } from "@fluenshift/contract";
import type { LearnerId } from "@fluenshift/contract";
import {
  categoryAbilities,
  Database,
  exerciseAttempts,
  exercises,
  learners,
  mistakePatterns,
} from "@fluenshift/db";
import type { DrizzleClient } from "@fluenshift/db";
import { and, count, eq } from "drizzle-orm";
import { Effect } from "effect";
import type { Layer } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CurrentLearner, LOCAL_LEARNER_ID } from "../learner-identity";
import { makeTemporaryDatabase } from "../test/database";
import {
  explainAttempt,
  generatePracticeSet,
  NotFoundError,
  submitAttempt,
} from "./exercise-service";
import type { TrainerMethods } from "./trainer/trainer-model";

let database: Awaited<ReturnType<typeof makeTemporaryDatabase>>;

type Services = Layer.Success<typeof database.layer>;

const run = <A, E>(effect: Effect.Effect<A, E, Services>) =>
  Effect.runPromise(effect.pipe(Effect.provide(database.layer)));

// The same effect, acting for another Learner.
const runAs = <A, E>(
  learnerId: string,
  effect: Effect.Effect<A, E, Services>
) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provideService(
        CurrentLearner,
        CurrentLearner.of({ id: learnerId as LearnerId })
      ),
      Effect.provide(database.layer)
    )
  );

const query = <A>(read: (client: DrizzleClient) => Promise<A>) =>
  run(
    Effect.gen(function* () {
      const service = yield* Database;
      return yield* service.run(read);
    })
  );

const only = <Row>(rows: readonly Row[]): Row => {
  const [row] = rows;
  if (row === undefined) {
    throw new Error("Expected one row");
  }
  return row;
};

beforeEach(async () => {
  database = await makeTemporaryDatabase();
});

afterEach(async () => {
  await rm(database.directory, { force: true, recursive: true });
});

const seedPattern = (
  overrides: {
    readonly consecutiveCorrectCount?: number;
    readonly masteryLevel?: MasteryLevel;
  } = {}
) =>
  query((client) =>
    client
      .insert(learners)
      .values({ id: LOCAL_LEARNER_ID })
      .onConflictDoNothing()
      .then(() =>
        client
          .insert(mistakePatterns)
          .values({
            category: MistakeCategory.PREPOSITIONS,
            exampleCorrection: "I depend on this library.",
            exampleOriginal: "I depend of this library.",
            id: randomUUID(),
            learnerId: LOCAL_LEARNER_ID,
            occurrenceCount: 3,
            patternKey: "depend-on",
            ...overrides,
          })
          .returning()
      )
  ).then(only);

const fakeGeneratedExercise = () => ({
  correctOptionIndex: 1,
  explanation: "Use 'depend on', not 'depend of'.",
  instruction: "Choose the correct sentence.",
  options: ["I depend of this library.", "I depend on this library."],
  type: "MULTIPLE_CHOICE" as const,
});

const seedExercise = (
  sourcePatternId: string,
  extra: { readonly difficulty?: number } = {}
) =>
  query((client) =>
    client
      .insert(exercises)
      .values({
        id: randomUUID(),
        learnerId: LOCAL_LEARNER_ID,
        model: "test-model",
        promptData: fakeGeneratedExercise(),
        sourcePatternId,
        type: "MULTIPLE_CHOICE",
        ...extra,
      })
      .returning()
  ).then(only);

const findPattern = (id: string) =>
  query((client) =>
    client.select().from(mistakePatterns).where(eq(mistakePatterns.id, id))
  ).then(only);

const findAttempt = (id: string) =>
  query((client) =>
    client.select().from(exerciseAttempts).where(eq(exerciseAttempts.id, id))
  ).then(only);

// A Trainer whose calls nobody answers unless a case gives them an answer.
const fakeTrainer = (answers: Partial<TrainerMethods> = {}) => ({
  continueInterview: vi.fn<TrainerMethods["continueInterview"]>(),
  enrichFindings: vi.fn<TrainerMethods["enrichFindings"]>(),
  explainAttempt: vi.fn<TrainerMethods["explainAttempt"]>(),
  generateExercises: vi.fn<TrainerMethods["generateExercises"]>(),
  ...answers,
});

const generating = (model = "test-model") =>
  vi.fn<TrainerMethods["generateExercises"]>(() =>
    Effect.succeed({ exercises: [fakeGeneratedExercise()], model })
  );

describe("exerciseGenerationService.generatePracticeSet", () => {
  it("returns nothing when the user has no mistake patterns yet", async () => {
    const trainer = fakeTrainer();

    const result = await run(generatePracticeSet(trainer));

    expect(result).toEqual([]);
    expect(trainer.generateExercises).not.toHaveBeenCalled();
  });

  it("generates and persists one exercise per selected pattern", async () => {
    const pattern = await seedPattern();
    const trainer = fakeTrainer({ generateExercises: generating() });

    const result = await run(generatePracticeSet(trainer, 1));

    expect(result).toHaveLength(1);
    expect(result[0]?.sourcePatternId).toBe(pattern.id);
    expect(result[0]?.type).toBe("MULTIPLE_CHOICE");
  });

  it("records the model that generated each Exercise", async () => {
    await seedPattern();
    const trainer = fakeTrainer({
      generateExercises: generating("fallback-model"),
    });

    const [created] = await run(generatePracticeSet(trainer, 1));

    expect(created?.model).toBe("fallback-model");
    const stored = await query((client) => client.select().from(exercises));
    expect(stored.map((exercise) => exercise.model)).toStrictEqual([
      "fallback-model",
    ]);
  });
});

describe("exerciseAttemptService.submitAttempt", () => {
  it("records a correct attempt and promotes the pattern's mastery streak", async () => {
    const pattern = await seedPattern({
      consecutiveCorrectCount: 1,
      masteryLevel: MasteryLevel.ACTIVE,
    });
    const exercise = await seedExercise(pattern.id);

    const result = await run(submitAttempt(exercise.id, "1"));

    expect(result.isCorrect).toBe(true);

    const updatedPattern = await findPattern(pattern.id);
    expect(updatedPattern.masteryLevel).toBe("IMPROVING");
    expect(updatedPattern.consecutiveCorrectCount).toBe(0);
    expect(updatedPattern.correctCount).toBe(pattern.correctCount + 1);
    expect(updatedPattern.incorrectCount).toBe(pattern.incorrectCount);
    expect(updatedPattern.lastPracticedAt.getTime()).toBeGreaterThanOrEqual(
      pattern.lastPracticedAt.getTime()
    );
  });

  it("records an incorrect attempt and resets an IMPROVING pattern to ACTIVE", async () => {
    const pattern = await seedPattern({
      consecutiveCorrectCount: 1,
      masteryLevel: MasteryLevel.IMPROVING,
    });
    const exercise = await seedExercise(pattern.id);

    const result = await run(submitAttempt(exercise.id, "0"));

    expect(result.isCorrect).toBe(false);

    const updatedPattern = await findPattern(pattern.id);
    expect(updatedPattern.masteryLevel).toBe("ACTIVE");
    expect(updatedPattern.incorrectCount).toBe(pattern.incorrectCount + 1);
    expect(updatedPattern.correctCount).toBe(pattern.correctCount);
  });

  it("does not require an AI provider to grade an attempt", async () => {
    const pattern = await seedPattern();
    const exercise = await seedExercise(pattern.id);

    // submitAttempt takes no Trainer: this test's mere existence (and passing) proves grading
    // has no AI dependency.
    const result = await run(submitAttempt(exercise.id, "1"));

    expect(result.isCorrect).toBe(true);
  });
});

describe("attemptExplanationService.explainAttempt", () => {
  it("explains a graded attempt without changing it", async () => {
    const pattern = await seedPattern();
    const exercise = await seedExercise(pattern.id);
    const graded = await run(submitAttempt(exercise.id, "0"));
    const explaining = vi.fn<TrainerMethods["explainAttempt"]>(() =>
      Effect.succeed({
        explanation: "You picked the wrong preposition.",
        model: "test-model",
      })
    );
    const trainer = fakeTrainer({ explainAttempt: explaining });

    const explanation = await run(
      explainAttempt(trainer, {
        attemptId: graded.attemptId,
        exerciseId: exercise.id,
      })
    );

    expect(explanation).toBe("You picked the wrong preposition.");
    expect(explaining).toHaveBeenCalledWith(
      expect.objectContaining({ learnerAnswer: "0" })
    );
    const attempt = await findAttempt(graded.attemptId);
    expect(attempt.isCorrect).toBe(false);
  });

  it("returns null for an attempt that isn't the user's on that exercise", async () => {
    const trainer = fakeTrainer();

    expect(
      await run(
        explainAttempt(trainer, { attemptId: "nope", exerciseId: "nope" })
      )
    ).toBeNull();
    expect(trainer.explainAttempt).not.toHaveBeenCalled();
  });
});

describe("difficulty targeting", () => {
  it("raises the category ability after a correct attempt on a rated exercise", async () => {
    const pattern = await seedPattern();
    const exercise = await seedExercise(pattern.id, { difficulty: 3 });

    await run(submitAttempt(exercise.id, "1"));

    const ability = await query((client) =>
      client
        .select()
        .from(categoryAbilities)
        .where(
          and(
            eq(categoryAbilities.learnerId, LOCAL_LEARNER_ID),
            eq(categoryAbilities.category, pattern.category)
          )
        )
    ).then(only);
    expect(ability.rating).toBeGreaterThan(1000);
    expect(ability.attemptCount).toBe(1);
  });

  it("asks the generator for a difficulty and stores it on the exercise", async () => {
    await seedPattern();
    const generateExercises = generating();

    const [created] = await run(
      generatePracticeSet(fakeTrainer({ generateExercises }), 1)
    );

    const targets = generateExercises.mock.calls[0]?.[0];
    expect(targets?.[0]?.difficulty).toBeGreaterThanOrEqual(1);
    expect(targets?.[0]?.difficulty).toBeLessThanOrEqual(5);
    expect(created?.difficulty).toBe(targets?.[0]?.difficulty);
  });
});

describe("exerciseAttemptService ownership", () => {
  it("rejects another user's exercise and leaves the owner's data untouched", async () => {
    const pattern = await seedPattern({
      consecutiveCorrectCount: 1,
      masteryLevel: MasteryLevel.ACTIVE,
    });
    const exercise = await seedExercise(pattern.id);
    await query((client) => client.insert(learners).values({ id: "intruder" }));

    await expect(
      runAs("intruder", submitAttempt(exercise.id, "1"))
    ).rejects.toBeInstanceOf(NotFoundError);

    const [attempts] = await query((client) =>
      client.select({ total: count() }).from(exerciseAttempts)
    );
    expect(attempts?.total).toBe(0);
    const after = await findPattern(pattern.id);
    expect(after.consecutiveCorrectCount).toBe(1);
    expect(after.masteryLevel).toBe(MasteryLevel.ACTIVE);
  });
});
