// AI SDK mock models for the Trainer's tests: each answers one text, as a provider's structured
// output arrives once the AI SDK has read the provider's response.
import { MockLanguageModelV4 } from "ai/test";

export const answering = (
  provider: string,
  modelId: string,
  text: string
): MockLanguageModelV4 =>
  new MockLanguageModelV4({
    doGenerate: {
      content: [{ text, type: "text" }],
      finishReason: { raw: "stop", unified: "stop" },
      response: { modelId },
      usage: {
        inputTokens: {
          cacheRead: undefined,
          cacheWrite: undefined,
          noCache: 1,
          total: 1,
        },
        outputTokens: { reasoning: undefined, text: 1, total: 1 },
      },
      warnings: [],
    },
    modelId,
    provider,
  });

export const fakeMultipleChoiceExercise = () => ({
  correctOptionIndex: 1,
  explanation: "Use 'depend on', not 'depend of'.",
  instruction: "Choose the correct sentence.",
  options: ["I depend of this library.", "I depend on this library."],
  type: "MULTIPLE_CHOICE",
});

export const oneTarget = [
  {
    category: "PREPOSITIONS",
    difficulty: 3,
    exampleCorrection: "I depend on this library.",
    exampleOriginal: "I depend of this library.",
    type: "MULTIPLE_CHOICE",
  },
] as const;

export const explainInput = {
  exercise: {
    acceptableAnswers: ["on"],
    explanation: "'Depend on'.",
    instruction: "Fill the blank.",
    template: "It depends ___ the config.",
    type: "FILL_BLANK" as const,
  },
  userAnswer: "of",
};
