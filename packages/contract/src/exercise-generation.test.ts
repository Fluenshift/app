import { Option, Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  AIResponseValidationError,
  exerciseGenerationResultSchema,
  validateExerciseGenerationResult,
} from "./exercise-generation";

// Zod's `schema.safeParse(input)`: decode with Effect Schema and report whether it succeeded
// and the decoded value, so every assertion on `result.success` and `result.data` stays as in
// the source test.
const safeParse = (
  schema: Schema.ConstraintDecoder<unknown>,
  input: unknown
): { readonly success: boolean; readonly data: unknown } => {
  const decoded = Schema.decodeUnknownOption(schema)(input);
  return {
    success: Option.isSome(decoded),
    data: Option.getOrUndefined(decoded),
  };
};

const mcExercise = (correctOptionIndex: number) => ({
  type: "MULTIPLE_CHOICE" as const,
  instruction: "Choose the correct sentence.",
  explanation: "Use 'depend on', not 'depend of'.",
  options: ["I depend of this library.", "I depend on this library."],
  correctOptionIndex,
});

describe("exerciseGenerationResultSchema", () => {
  it("accepts one well-formed exercise of each type", () => {
    const result = safeParse(exerciseGenerationResultSchema, {
      exercises: [
        {
          type: "MULTIPLE_CHOICE",
          instruction: "Choose the correct sentence.",
          explanation: "Use 'depend on', not 'depend of'.",
          options: ["I depend of this library.", "I depend on this library."],
          correctOptionIndex: 1,
        },
        {
          type: "FILL_BLANK",
          instruction: "Fill in the blank.",
          explanation: "'Have difficulty' takes a gerund.",
          template: "I have difficulty ______ concurrency.",
          acceptableAnswers: ["understanding"],
        },
        {
          type: "REWRITE",
          instruction: "Rewrite naturally.",
          explanation: "Prefer the gerund form.",
          original: "I have difficulty to understand concurrency.",
          acceptableAnswers: ["I have difficulty understanding concurrency."],
        },
        {
          type: "TRANSLATION",
          instruction: "Translate into English.",
          explanation: "Watch out for the preposition.",
          sourceText: "Eu dependo desta biblioteca.",
          acceptableAnswers: ["I depend on this library."],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty exercises array", () => {
    const result = safeParse(exerciseGenerationResultSchema, { exercises: [] });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown exercise type", () => {
    const result = safeParse(exerciseGenerationResultSchema, {
      exercises: [{ type: "TRUE_FALSE", instruction: "x", explanation: "x" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a multiple-choice exercise with fewer than two options", () => {
    const result = safeParse(exerciseGenerationResultSchema, {
      exercises: [
        {
          type: "MULTIPLE_CHOICE",
          instruction: "x",
          explanation: "x",
          options: ["only one"],
          correctOptionIndex: 0,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a fill-blank exercise with no acceptable answers", () => {
    const result = safeParse(exerciseGenerationResultSchema, {
      exercises: [
        {
          type: "FILL_BLANK",
          instruction: "x",
          explanation: "x",
          template: "x ______ y",
          acceptableAnswers: [],
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("validateExerciseGenerationResult", () => {
  it("returns the exercises when the count matches and every MC index is in range", () => {
    const result = validateExerciseGenerationResult(
      { exercises: [mcExercise(1)] },
      1
    );
    expect(result).toHaveLength(1);
  });

  it("throws when the exercise count doesn't match the requested target count", () => {
    expect(() =>
      validateExerciseGenerationResult({ exercises: [mcExercise(1)] }, 2)
    ).toThrow(AIResponseValidationError);
  });

  it("throws when a multiple-choice correctOptionIndex is out of range", () => {
    expect(() =>
      validateExerciseGenerationResult({ exercises: [mcExercise(5)] }, 1)
    ).toThrow(AIResponseValidationError);
  });
});

const text = (length: number) => "x".repeat(length);

const answers = (count: number, length = 1) =>
  Array.from({ length: count }, () => text(length));

const multipleChoice = (overrides: Record<string, unknown> = {}) => ({
  type: "MULTIPLE_CHOICE",
  instruction: "x",
  explanation: "x",
  options: ["a", "b"],
  correctOptionIndex: 0,
  ...overrides,
});

const fillBlank = (overrides: Record<string, unknown> = {}) => ({
  type: "FILL_BLANK",
  instruction: "x",
  explanation: "x",
  template: "x ______ y",
  acceptableAnswers: ["x"],
  ...overrides,
});

const rewrite = (overrides: Record<string, unknown> = {}) => ({
  type: "REWRITE",
  instruction: "x",
  explanation: "x",
  original: "x",
  acceptableAnswers: ["x"],
  ...overrides,
});

const translation = (overrides: Record<string, unknown> = {}) => ({
  type: "TRANSLATION",
  instruction: "x",
  explanation: "x",
  sourceText: "x",
  acceptableAnswers: ["x"],
  ...overrides,
});

const exercises = (count: number) =>
  Array.from({ length: count }, () => multipleChoice());

const accepts = (exercise: unknown) =>
  safeParse(exerciseGenerationResultSchema, { exercises: [exercise] }).success;

describe("exerciseGenerationResultSchema bounds", () => {
  it("bounds the instruction to 1-300 characters and the explanation to 1-1000", () => {
    expect(accepts(multipleChoice({ instruction: text(300) }))).toBe(true);
    expect(accepts(multipleChoice({ instruction: text(301) }))).toBe(false);
    expect(accepts(multipleChoice({ instruction: "" }))).toBe(false);
    expect(accepts(multipleChoice({ explanation: text(1000) }))).toBe(true);
    expect(accepts(multipleChoice({ explanation: text(1001) }))).toBe(false);
    expect(accepts(multipleChoice({ explanation: "" }))).toBe(false);
  });

  it("bounds multiple choice to 2-5 options of 1-300 characters and a non-negative integer index", () => {
    expect(accepts(multipleChoice({ options: answers(5) }))).toBe(true);
    expect(accepts(multipleChoice({ options: answers(6) }))).toBe(false);
    expect(accepts(multipleChoice({ options: ["a", text(300)] }))).toBe(true);
    expect(accepts(multipleChoice({ options: ["a", text(301)] }))).toBe(false);
    expect(accepts(multipleChoice({ options: ["a", ""] }))).toBe(false);
    expect(accepts(multipleChoice({ correctOptionIndex: 9 }))).toBe(true);
    expect(accepts(multipleChoice({ correctOptionIndex: -1 }))).toBe(false);
    expect(accepts(multipleChoice({ correctOptionIndex: 0.5 }))).toBe(false);
  });

  it("bounds fill-blank templates to 1-300 characters and answers to 1-5 of 1-100", () => {
    expect(accepts(fillBlank({ template: text(300) }))).toBe(true);
    expect(accepts(fillBlank({ template: text(301) }))).toBe(false);
    expect(accepts(fillBlank({ template: "" }))).toBe(false);
    expect(accepts(fillBlank({ acceptableAnswers: answers(5) }))).toBe(true);
    expect(accepts(fillBlank({ acceptableAnswers: answers(6) }))).toBe(false);
    expect(accepts(fillBlank({ acceptableAnswers: answers(1, 100) }))).toBe(
      true
    );
    expect(accepts(fillBlank({ acceptableAnswers: answers(1, 101) }))).toBe(
      false
    );
    expect(accepts(fillBlank({ acceptableAnswers: [""] }))).toBe(false);
  });

  it("bounds rewrite and translation texts to 1-500 characters and answers to 1-3 of 1-500", () => {
    for (const [build, field] of [
      [rewrite, "original"],
      [translation, "sourceText"],
    ] as const) {
      expect(accepts(build({ [field]: text(500) }))).toBe(true);
      expect(accepts(build({ [field]: text(501) }))).toBe(false);
      expect(accepts(build({ [field]: "" }))).toBe(false);
      expect(accepts(build({ acceptableAnswers: answers(3) }))).toBe(true);
      expect(accepts(build({ acceptableAnswers: answers(4) }))).toBe(false);
      expect(accepts(build({ acceptableAnswers: [] }))).toBe(false);
      expect(accepts(build({ acceptableAnswers: answers(1, 500) }))).toBe(true);
      expect(accepts(build({ acceptableAnswers: answers(1, 501) }))).toBe(
        false
      );
      expect(accepts(build({ acceptableAnswers: [""] }))).toBe(false);
    }
  });

  it("accepts one to ten exercises", () => {
    expect(
      safeParse(exerciseGenerationResultSchema, { exercises: exercises(10) })
        .success
    ).toBe(true);
    expect(
      safeParse(exerciseGenerationResultSchema, { exercises: exercises(11) })
        .success
    ).toBe(false);
  });

  it("drops properties the schema does not declare", () => {
    const result = safeParse(exerciseGenerationResultSchema, {
      exercises: [multipleChoice({ hint: "x" })],
      extra: true,
    });
    expect(result.data).toEqual({ exercises: [multipleChoice()] });
  });
});

describe("validateExerciseGenerationResult guards", () => {
  it("accepts the last option as the correct one and rejects the index past it", () => {
    expect(
      validateExerciseGenerationResult({ exercises: [mcExercise(1)] }, 1)
    ).toHaveLength(1);
    expect(() =>
      validateExerciseGenerationResult({ exercises: [mcExercise(2)] }, 1)
    ).toThrow(AIResponseValidationError);
  });

  it("explains each rejection", () => {
    expect(() =>
      validateExerciseGenerationResult({ exercises: [mcExercise(1)] }, 2)
    ).toThrow("Expected 2 exercises, got 1");
    expect(() =>
      validateExerciseGenerationResult({ exercises: [mcExercise(2)] }, 1)
    ).toThrow(
      "A multiple-choice exercise's correctOptionIndex is out of range"
    );
  });
});
