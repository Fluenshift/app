// The exercises the Trainer's model must return, ported from Grifando
// src/server/ai/schemas/exerciseGeneration.ts: the same fields and bounds, from Zod to Effect
// Schema. AIResponseValidationError comes from src/server/ai/errors.ts.
import { Schema } from "effect";

// Thrown when an AI response doesn't match its expected schema. Callers should treat this as a
// handled failure (keep original input, never persist), not a crash.
export class AIResponseValidationError extends Schema.TaggedError<
  AIResponseValidationError,
  { readonly brand: unique symbol }
>()("AIResponseValidationError", {
  issues: Schema.Array(
    Schema.Struct({
      message: Schema.String,
      path: Schema.Array(Schema.PropertyKey),
    })
  ),
  message: Schema.String,
}) {}

const baseFields = {
  instruction: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(300)
  ),
  explanation: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(1000)
  ),
};

export const multipleChoiceExerciseSchema = Schema.Struct({
  type: Schema.Literal("MULTIPLE_CHOICE"),
  ...baseFields,
  options: Schema.Array(
    Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(300))
  ).check(Schema.isMinLength(2), Schema.isMaxLength(5)),
  correctOptionIndex: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

export const fillBlankExerciseSchema = Schema.Struct({
  type: Schema.Literal("FILL_BLANK"),
  ...baseFields,
  template: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(300)),
  acceptableAnswers: Schema.Array(
    Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100))
  ).check(Schema.isMinLength(1), Schema.isMaxLength(5)),
});

export const rewriteExerciseSchema = Schema.Struct({
  type: Schema.Literal("REWRITE"),
  ...baseFields,
  original: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(500)),
  acceptableAnswers: Schema.Array(
    Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(500))
  ).check(Schema.isMinLength(1), Schema.isMaxLength(3)),
});

export const translationExerciseSchema = Schema.Struct({
  type: Schema.Literal("TRANSLATION"),
  ...baseFields,
  sourceText: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(500)
  ),
  acceptableAnswers: Schema.Array(
    Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(500))
  ).check(Schema.isMinLength(1), Schema.isMaxLength(3)),
});

export const generatedExerciseSchema = Schema.Union([
  multipleChoiceExerciseSchema,
  fillBlankExerciseSchema,
  rewriteExerciseSchema,
  translationExerciseSchema,
]);

export const exerciseGenerationResultSchema = Schema.Struct({
  exercises: Schema.Array(generatedExerciseSchema).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(10)
  ),
});

export type GeneratedExercise = typeof generatedExerciseSchema.Type;
export type ExerciseGenerationResult =
  typeof exerciseGenerationResultSchema.Type;

// Provider-agnostic business rules on top of schema validity, shared by every provider so they
// don't each reimplement these checks.
export const validateExerciseGenerationResult = (
  result: ExerciseGenerationResult,
  targetCount: number
): readonly GeneratedExercise[] => {
  if (result.exercises.length !== targetCount) {
    throw new AIResponseValidationError({
      issues: [],
      message: `Expected ${targetCount} exercises, got ${result.exercises.length}`,
    });
  }

  const invalidMultipleChoice = result.exercises.find(
    (exercise) =>
      exercise.type === "MULTIPLE_CHOICE" &&
      exercise.correctOptionIndex >= exercise.options.length
  );

  if (invalidMultipleChoice) {
    throw new AIResponseValidationError({
      issues: [],
      message:
        "A multiple-choice exercise's correctOptionIndex is out of range",
    });
  }

  return result.exercises;
};
