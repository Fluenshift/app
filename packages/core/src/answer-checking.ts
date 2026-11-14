// Grading of exercise answers, ported from Grifando
// src/server/domain/exercises/answerChecking.ts. Grading is deterministic: no model call.
import type { GeneratedExercise } from "@fluenshift/contract";
import { absurd } from "effect";

const normalizeAnswer = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replaceAll(/[.!?]+$/gu, "")
    .replaceAll(/\s+/gu, " ");

// Deliberately simple, deterministic matching (no second AI call to grade free-text answers):
// case, whitespace and trailing-punctuation insensitive against every acceptable answer the
// generator provided. Known tradeoff: a valid rephrasing the generator didn't anticipate reads
// as incorrect.
export const isTextAnswerAcceptable = (
  userAnswer: string,
  acceptableAnswers: readonly string[]
): boolean => {
  const normalizedUserAnswer = normalizeAnswer(userAnswer);
  return acceptableAnswers.some(
    (answer) => normalizeAnswer(answer) === normalizedUserAnswer
  );
};

// Grifando reads the answer with `Number.parseInt(userAnswer, 10)`, which lint rejects. This
// reads it the same way: skip leading whitespace, then take an optional sign and the longest
// run of decimal digits; no digit gives NaN. The replacement lint suggests,
// `Math.trunc(Number(userAnswer))`, differs: it reads "" as 0, so a blank answer would grade as
// option 0, and "1abc" as NaN.
const parseDecimalInteger = (value: string): number => {
  const digits = /^[+-]?\d+/u.exec(value.trimStart());
  return digits === null ? Number.NaN : Number(digits[0]);
};

export const isMultipleChoiceCorrect = (
  selectedIndex: number,
  correctOptionIndex: number
): boolean => selectedIndex === correctOptionIndex;

// Central dispatch so callers never need a type-by-type switch of their own.
export const evaluateExerciseAnswer = (
  exercise: GeneratedExercise,
  userAnswer: string
): boolean => {
  switch (exercise.type) {
    case "MULTIPLE_CHOICE": {
      const selectedIndex = parseDecimalInteger(userAnswer);
      return isMultipleChoiceCorrect(
        selectedIndex,
        exercise.correctOptionIndex
      );
    }
    case "FILL_BLANK":
    case "REWRITE":
    case "TRANSLATION": {
      return isTextAnswerAcceptable(userAnswer, exercise.acceptableAnswers);
    }
    // Lint requires a default; the cases above are exhaustive, so it cannot be reached.
    default: {
      return absurd(exercise);
    }
  }
};
