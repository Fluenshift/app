import { describe, expect, it } from "vitest";

import { buildAnswerExplanationUserMessage } from "./answer-explanation";

describe("buildAnswerExplanationUserMessage", () => {
  it("includes the learner's answer and the accepted answers for free-text exercises", () => {
    const message = buildAnswerExplanationUserMessage({
      exercise: {
        type: "REWRITE",
        instruction: "Rewrite the sentence correctly.",
        original: "I depend of this library.",
        acceptableAnswers: ["I depend on this library."],
        explanation: "'Depend' takes 'on'.",
      },
      learnerAnswer: "I depend from this library.",
    });

    expect(message).toContain("Learner answered: I depend from this library.");
    expect(message).toContain("Accepted answers: I depend on this library.");
    expect(message).toContain("Answer key note: 'Depend' takes 'on'.");
  });

  it("resolves the chosen and correct options for multiple choice", () => {
    const message = buildAnswerExplanationUserMessage({
      exercise: {
        type: "MULTIPLE_CHOICE",
        instruction: "Pick the correct preposition.",
        options: ["of", "on", "at"],
        correctOptionIndex: 1,
        explanation: "'Depend on'.",
      },
      learnerAnswer: "0",
    });

    expect(message).toContain("Correct option: on");
    expect(message).toContain("Learner chose: of");
  });
});
