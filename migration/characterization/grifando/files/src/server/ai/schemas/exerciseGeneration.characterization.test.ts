// Characterization of src/server/ai/schemas/exerciseGeneration.ts at the Grifando baseline:
// the baseline tests pin three of the schema's bounds, the out-of-range check only well past
// the last option, and neither error message of validateExerciseGenerationResult. Each bound
// here is checked at its limit and one past it.
import { describe, expect, it } from "vitest";

import { AIResponseValidationError } from "@/server/ai/errors";
import {
  exerciseGenerationResultSchema,
  validateExerciseGenerationResult,
} from "@/server/ai/schemas/exerciseGeneration";

function text(length: number) {
  return "x".repeat(length);
}

function answers(count: number, length = 1) {
  return Array.from({ length: count }, () => text(length));
}

function multipleChoice(overrides: Record<string, unknown> = {}) {
  return {
    type: "MULTIPLE_CHOICE",
    instruction: "x",
    explanation: "x",
    options: ["a", "b"],
    correctOptionIndex: 0,
    ...overrides,
  };
}

function fillBlank(overrides: Record<string, unknown> = {}) {
  return {
    type: "FILL_BLANK",
    instruction: "x",
    explanation: "x",
    template: "x ______ y",
    acceptableAnswers: ["x"],
    ...overrides,
  };
}

function rewrite(overrides: Record<string, unknown> = {}) {
  return {
    type: "REWRITE",
    instruction: "x",
    explanation: "x",
    original: "x",
    acceptableAnswers: ["x"],
    ...overrides,
  };
}

function translation(overrides: Record<string, unknown> = {}) {
  return {
    type: "TRANSLATION",
    instruction: "x",
    explanation: "x",
    sourceText: "x",
    acceptableAnswers: ["x"],
    ...overrides,
  };
}

function exercises(count: number) {
  return Array.from({ length: count }, () => multipleChoice());
}

function accepts(exercise: unknown) {
  return exerciseGenerationResultSchema.safeParse({ exercises: [exercise] }).success;
}

function mcExercise(correctOptionIndex: number) {
  return {
    type: "MULTIPLE_CHOICE" as const,
    instruction: "Choose the correct sentence.",
    explanation: "Use 'depend on', not 'depend of'.",
    options: ["I depend of this library.", "I depend on this library."],
    correctOptionIndex,
  };
}

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
    expect(accepts(fillBlank({ acceptableAnswers: answers(1, 100) }))).toBe(true);
    expect(accepts(fillBlank({ acceptableAnswers: answers(1, 101) }))).toBe(false);
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
      expect(accepts(build({ acceptableAnswers: answers(1, 501) }))).toBe(false);
      expect(accepts(build({ acceptableAnswers: [""] }))).toBe(false);
    }
  });

  it("accepts one to ten exercises", () => {
    expect(exerciseGenerationResultSchema.safeParse({ exercises: exercises(10) }).success).toBe(true);
    expect(exerciseGenerationResultSchema.safeParse({ exercises: exercises(11) }).success).toBe(false);
  });

  it("drops properties the schema does not declare", () => {
    const result = exerciseGenerationResultSchema.safeParse({
      exercises: [multipleChoice({ hint: "x" })],
      extra: true,
    });
    expect(result.data).toEqual({ exercises: [multipleChoice()] });
  });
});

describe("validateExerciseGenerationResult guards", () => {
  it("accepts the last option as the correct one and rejects the index past it", () => {
    expect(validateExerciseGenerationResult({ exercises: [mcExercise(1)] }, 1)).toHaveLength(1);
    expect(() => validateExerciseGenerationResult({ exercises: [mcExercise(2)] }, 1)).toThrow(
      AIResponseValidationError,
    );
  });

  it("explains each rejection", () => {
    expect(() => validateExerciseGenerationResult({ exercises: [mcExercise(1)] }, 2)).toThrow(
      "Expected 2 exercises, got 1",
    );
    expect(() => validateExerciseGenerationResult({ exercises: [mcExercise(2)] }, 1)).toThrow(
      "A multiple-choice exercise's correctOptionIndex is out of range",
    );
  });
});
