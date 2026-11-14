import type { GeneratedExercise } from "@fluenshift/contract";
import { describe, expect, it } from "vitest";

import {
  evaluateExerciseAnswer,
  isMultipleChoiceCorrect,
  isTextAnswerAcceptable,
} from "./answer-checking";

const multipleChoice = (correctOptionIndex: number): GeneratedExercise => ({
  type: "MULTIPLE_CHOICE",
  instruction: "x",
  explanation: "x",
  options: ["a", "b"],
  correctOptionIndex,
});

describe("isMultipleChoiceCorrect", () => {
  it("matches the exact correct index", () => {
    expect(isMultipleChoiceCorrect(1, 1)).toBe(true);
  });

  it("rejects a different index", () => {
    expect(isMultipleChoiceCorrect(0, 1)).toBe(false);
  });
});

describe("isTextAnswerAcceptable", () => {
  it("matches an exact acceptable answer", () => {
    expect(isTextAnswerAcceptable("understanding", ["understanding"])).toBe(
      true
    );
  });

  it("is case-insensitive", () => {
    expect(isTextAnswerAcceptable("Understanding", ["understanding"])).toBe(
      true
    );
  });

  it("ignores leading/trailing whitespace and trailing punctuation", () => {
    expect(
      isTextAnswerAcceptable("  I depend on this library.  ", [
        "I depend on this library",
      ])
    ).toBe(true);
  });

  it("matches any of several acceptable answers", () => {
    expect(isTextAnswerAcceptable("b", ["a", "b", "c"])).toBe(true);
  });

  it("rejects an answer that matches none of the acceptable answers", () => {
    expect(isTextAnswerAcceptable("wrong", ["right"])).toBe(false);
  });
});

describe("evaluateExerciseAnswer", () => {
  it("dispatches multiple choice by numeric index", () => {
    const exercise = {
      type: "MULTIPLE_CHOICE" as const,
      instruction: "x",
      explanation: "x",
      options: ["a", "b"],
      correctOptionIndex: 1,
    };
    expect(evaluateExerciseAnswer(exercise, "1")).toBe(true);
    expect(evaluateExerciseAnswer(exercise, "0")).toBe(false);
  });

  it("dispatches fill-blank by text match", () => {
    const exercise = {
      type: "FILL_BLANK" as const,
      instruction: "x",
      explanation: "x",
      template: "x ______ y",
      acceptableAnswers: ["understanding"],
    };
    expect(evaluateExerciseAnswer(exercise, "understanding")).toBe(true);
    expect(evaluateExerciseAnswer(exercise, "understand")).toBe(false);
  });
});

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

    expect(
      evaluateExerciseAnswer(
        rewrite,
        "i have difficulty understanding concurrency"
      )
    ).toBe(true);
    expect(
      evaluateExerciseAnswer(
        rewrite,
        "I have difficulty to understand concurrency."
      )
    ).toBe(false);
    expect(
      evaluateExerciseAnswer(translation, "I depend on this library!")
    ).toBe(true);
    expect(
      evaluateExerciseAnswer(translation, "I depend of this library.")
    ).toBe(false);
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
    expect(
      isTextAnswerAcceptable("I  depend\ton\nthis", ["I depend on this"])
    ).toBe(true);
  });

  it("trims before it strips trailing punctuation", () => {
    expect(isTextAnswerAcceptable("depend on .", ["depend on"])).toBe(false);
    expect(isTextAnswerAcceptable("depend on .", ["depend on ."])).toBe(true);
  });
});
