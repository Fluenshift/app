// Characterization of src/server/domain/exercises/answerChecking.ts at the Grifando baseline:
// the baseline tests pin neither how a multiple-choice answer is read as a number, nor the
// scope and order of the text normalization, nor the grading of rewrite and translation
// exercises.
import { describe, expect, it } from "vitest";

import type { GeneratedExercise } from "@/server/ai/schemas/exerciseGeneration";
import { evaluateExerciseAnswer, isTextAnswerAcceptable } from "@/server/domain/exercises/answerChecking";

function multipleChoice(correctOptionIndex: number): GeneratedExercise {
  return {
    type: "MULTIPLE_CHOICE",
    instruction: "x",
    explanation: "x",
    options: ["a", "b"],
    correctOptionIndex,
  };
}

describe("evaluateExerciseAnswer guards", () => {
  it("reads a multiple-choice answer as its leading decimal integer", () => {
    const exercise = multipleChoice(1);
    for (const answer of ["1", " 1", "\n1", "+1", "01", "1.9", "1e3", "1abc"]) {
      expect(evaluateExerciseAnswer(exercise, answer)).toBe(true);
    }
    expect(evaluateExerciseAnswer(exercise, "0x1")).toBe(false);
  });

  it("never reads a blank or non-numeric multiple-choice answer as option 0", () => {
    const exercise = multipleChoice(0);
    for (const answer of ["", " ", "abc", "-", "+", "x0"]) {
      expect(evaluateExerciseAnswer(exercise, answer)).toBe(false);
    }
    expect(evaluateExerciseAnswer(exercise, "0")).toBe(true);
    expect(evaluateExerciseAnswer(exercise, "-0")).toBe(true);
  });

  it("grades rewrite and translation answers against their acceptable answers", () => {
    const rewrite: GeneratedExercise = {
      type: "REWRITE",
      instruction: "x",
      explanation: "x",
      original: "I have difficulty to understand concurrency.",
      acceptableAnswers: ["I have difficulty understanding concurrency."],
    };
    const translation: GeneratedExercise = {
      type: "TRANSLATION",
      instruction: "x",
      explanation: "x",
      sourceText: "Eu dependo desta biblioteca.",
      acceptableAnswers: ["I depend on this library."],
    };

    expect(evaluateExerciseAnswer(rewrite, "i have difficulty understanding concurrency")).toBe(true);
    expect(evaluateExerciseAnswer(rewrite, "I have difficulty to understand concurrency.")).toBe(false);
    expect(evaluateExerciseAnswer(translation, "I depend on this library!")).toBe(true);
    expect(evaluateExerciseAnswer(translation, "I depend of this library.")).toBe(false);
  });
});

describe("isTextAnswerAcceptable guards", () => {
  it("strips any trailing run of periods, exclamation marks and question marks", () => {
    expect(isTextAnswerAcceptable("Really?!...", ["really"])).toBe(true);
    expect(isTextAnswerAcceptable("really", ["Really?"])).toBe(true);
    expect(isTextAnswerAcceptable("really,", ["really"])).toBe(false);
    expect(isTextAnswerAcceptable("really;", ["really"])).toBe(false);
    expect(isTextAnswerAcceptable("...really", ["really"])).toBe(false);
  });

  it("collapses every inner whitespace run to one space", () => {
    expect(isTextAnswerAcceptable("I  depend\ton\nthis", ["I depend on this"])).toBe(true);
  });

  it("trims before it strips trailing punctuation", () => {
    expect(isTextAnswerAcceptable("depend on .", ["depend on"])).toBe(false);
    expect(isTextAnswerAcceptable("depend on .", ["depend on ."])).toBe(true);
  });
});
