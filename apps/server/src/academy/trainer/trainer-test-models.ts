// AI SDK mock models for the Trainer's tests: each answers one text, as a provider's structured
// output arrives once the AI SDK has read the provider's response, or refuses the call.
import { APICallError } from "ai";
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

// A model whose provider refuses the call with an API error of that status.
export const refusing = (
  provider: string,
  statusCode: number,
  message = "The provider refused the call"
): MockLanguageModelV4 =>
  new MockLanguageModelV4({
    doGenerate: () =>
      Promise.reject(
        new APICallError({
          message,
          requestBodyValues: {},
          statusCode,
          url: "https://provider.test",
        })
      ),
    modelId: "m",
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

// Two Findings for the Enrichment, and the entry a model returns for the first one.
export const enrichmentInput = {
  findings: [
    {
      category: "Preposition",
      correction: "depend on",
      explanation: "Use 'depend on', not 'depend of'.",
      originalText: "depend of",
    },
    {
      category: "Article",
      correction: "it",
      explanation: "No article before a pronoun.",
      originalText: "the it",
    },
  ],
  writingSample: "I depend of the it.",
} as const;

export const fakeFindingEnrichment = () => ({
  category: "PREPOSITIONS",
  example: "I depend on my team.",
  finding: 1,
  l1Transfer: true,
  patternKey: "depend-on",
});

export const fakeArticleEnrichment = () => ({
  category: "ARTICLES",
  example: "It works.",
  finding: 2,
  l1Transfer: false,
  patternKey: "no-article-before-pronoun",
});
