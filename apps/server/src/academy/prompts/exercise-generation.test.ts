import { ExerciseType, MistakeCategory } from "@fluenshift/contract";
import { describe, expect, it } from "vitest";

import { buildExerciseGenerationUserMessage } from "./exercise-generation";

describe("buildExerciseGenerationUserMessage", () => {
  it("includes every target's type, category, and example", () => {
    const message = buildExerciseGenerationUserMessage([
      {
        type: ExerciseType.MULTIPLE_CHOICE,
        category: MistakeCategory.PREPOSITIONS,
        exampleOriginal: "I depend of this library.",
        exampleCorrection: "I depend on this library.",
        difficulty: 3,
      },
      {
        type: ExerciseType.FILL_BLANK,
        category: MistakeCategory.VERB_TENSE,
        exampleOriginal: "difficulty to understand",
        exampleCorrection: "difficulty understanding",
        difficulty: 3,
      },
    ]);

    expect(message).toContain("MULTIPLE_CHOICE");
    expect(message).toContain("PREPOSITIONS");
    expect(message).toContain("I depend of this library.");
    expect(message).toContain("FILL_BLANK");
    expect(message).toContain("VERB_TENSE");
    expect(message).toContain("Difficulty: 3/5");
  });

  it("numbers targets in order", () => {
    const message = buildExerciseGenerationUserMessage([
      {
        type: ExerciseType.REWRITE,
        category: MistakeCategory.ARTICLES,
        exampleOriginal: "a",
        exampleCorrection: "b",
        difficulty: 3,
      },
      {
        type: ExerciseType.TRANSLATION,
        category: MistakeCategory.ARTICLES,
        exampleOriginal: "c",
        exampleCorrection: "d",
        difficulty: 3,
      },
    ]);

    expect(message.indexOf("1. Type: REWRITE")).toBeLessThan(
      message.indexOf("2. Type: TRANSLATION")
    );
  });
});
