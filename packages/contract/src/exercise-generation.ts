// Typed stub for the red commit of #17: the ported tests compile and fail on their checks.
import { Schema } from "effect";

interface ExerciseFields {
  readonly explanation: string;
  readonly instruction: string;
}

export type GeneratedExercise =
  | (ExerciseFields & {
      readonly correctOptionIndex: number;
      readonly options: readonly string[];
      readonly type: "MULTIPLE_CHOICE";
    })
  | (ExerciseFields & {
      readonly acceptableAnswers: readonly string[];
      readonly template: string;
      readonly type: "FILL_BLANK";
    })
  | (ExerciseFields & {
      readonly acceptableAnswers: readonly string[];
      readonly original: string;
      readonly type: "REWRITE";
    })
  | (ExerciseFields & {
      readonly acceptableAnswers: readonly string[];
      readonly sourceText: string;
      readonly type: "TRANSLATION";
    });

export interface ExerciseGenerationResult {
  readonly exercises: readonly GeneratedExercise[];
}

// Accepts at most one exercise of any shape, so no check can pass yet.
export const exerciseGenerationResultSchema = Schema.Struct({
  exercises: Schema.Array(Schema.Unknown).check(Schema.isMaxLength(1)),
});

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

// Returns no exercises and never throws, so no check can pass yet.
export const validateExerciseGenerationResult: (
  result: ExerciseGenerationResult,
  targetCount: number
) => readonly GeneratedExercise[] = () => [];
