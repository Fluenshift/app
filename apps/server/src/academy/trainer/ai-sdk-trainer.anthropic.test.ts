// Ported from Grifando src/server/ai/providers/anthropic.test.ts (74dbb9f). Grifando faked the
// Anthropic SDK's messages client; on the AI SDK one Trainer serves every provider, so each case
// gives it a mock Anthropic model that answers what the tool_use block carried, or no object at
// all, and the key check reads the call that reached the model. The analyzeWriting cases are
// superseded (docs/adr/0004).
import { AIResponseValidationError } from "@fluenshift/contract";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createAiSdkTrainer, testKey } from "./ai-sdk-trainer";
import {
  TrainerKeyRejectedError,
  TrainerUnavailableError,
} from "./trainer-errors";
import {
  answering,
  enrichmentAnswer,
  enrichmentInput,
  explainInput,
  fakeArticleEnrichment,
  fakeFindingEnrichment,
  fakeMultipleChoiceExercise,
  fakeNaturalnessNote,
  oneTarget,
  refusing,
} from "./trainer-test-models";

const anthropicAnswering = (answer: unknown) =>
  createAiSdkTrainer(
    answering(
      "anthropic.messages",
      "test-model",
      typeof answer === "string" ? answer : JSON.stringify(answer)
    )
  );

describe("createAnthropicProvider.generateExercises", () => {
  it("returns the validated exercises when the model returns a well-formed tool_use block", async () => {
    const provider = anthropicAnswering({
      exercises: [fakeMultipleChoiceExercise()],
    });

    const result = await Effect.runPromise(
      provider.generateExercises(oneTarget)
    );

    expect(result.exercises).toHaveLength(1);
    expect(result.exercises[0]?.type).toBe("MULTIPLE_CHOICE");
    expect(result.model).toBe("test-model");
  });

  it("throws AIResponseValidationError when the exercise count doesn't match the target count", async () => {
    const provider = anthropicAnswering({ exercises: [] });

    await expect(
      Effect.runPromise(provider.generateExercises(oneTarget))
    ).rejects.toBeInstanceOf(AIResponseValidationError);
  });

  it("throws AIResponseValidationError when a multiple-choice correctOptionIndex is out of range", async () => {
    const provider = anthropicAnswering({
      exercises: [{ ...fakeMultipleChoiceExercise(), correctOptionIndex: 5 }],
    });

    await expect(
      Effect.runPromise(provider.generateExercises(oneTarget))
    ).rejects.toBeInstanceOf(AIResponseValidationError);
  });

  it("throws AIResponseValidationError when no tool_use block is returned", async () => {
    const provider = anthropicAnswering("no.");

    await expect(
      Effect.runPromise(provider.generateExercises(oneTarget))
    ).rejects.toBeInstanceOf(AIResponseValidationError);
  });
});

describe("createAnthropicProvider.continueInterview", () => {
  it("returns the validated next question", async () => {
    const provider = anthropicAnswering({
      question: "Tell me about a project you're proud of.",
    });

    const result = await Effect.runPromise(provider.continueInterview([]));

    expect(result.question).toBe("Tell me about a project you're proud of.");
  });

  it("throws AIResponseValidationError when the tool input fails schema validation", async () => {
    const provider = anthropicAnswering({});

    await expect(
      Effect.runPromise(provider.continueInterview([]))
    ).rejects.toBeInstanceOf(AIResponseValidationError);
  });
});

describe("createAnthropicProvider.explainAttempt", () => {
  it("returns the validated explanation", async () => {
    const provider = anthropicAnswering({
      explanation: "'Depend' is followed by 'on', not 'of'.",
    });

    const result = await Effect.runPromise(
      provider.explainAttempt(explainInput)
    );

    expect(result.explanation).toContain("'on'");
  });

  it("throws AIResponseValidationError on an invalid tool input", async () => {
    const provider = anthropicAnswering({});

    await expect(
      Effect.runPromise(provider.explainAttempt(explainInput))
    ).rejects.toBeInstanceOf(AIResponseValidationError);
  });
});

describe("createAnthropicProvider.enrichFindings", () => {
  it("returns each Finding's enrichment and the model that answered", async () => {
    const provider = anthropicAnswering(
      enrichmentAnswer([fakeFindingEnrichment(), fakeArticleEnrichment()])
    );

    const result = await Effect.runPromise(
      provider.enrichFindings(enrichmentInput)
    );

    expect(result).toStrictEqual({
      findings: [
        {
          category: "PREPOSITIONS",
          example: "I depend on my team.",
          l1Transfer: true,
          patternKey: "depend-on",
        },
        {
          category: "ARTICLES",
          example: "It works.",
          l1Transfer: false,
          patternKey: "no-article-before-pronoun",
        },
      ],
      model: "test-model",
      naturalVersion: "I rely on it.",
      naturalnessNotes: [],
    });
  });

  it("orders the enrichments by Finding, whatever order the model answers in", async () => {
    const provider = anthropicAnswering(
      enrichmentAnswer([fakeArticleEnrichment(), fakeFindingEnrichment()])
    );

    const result = await Effect.runPromise(
      provider.enrichFindings(enrichmentInput)
    );

    expect(result.findings.map((finding) => finding.patternKey)).toStrictEqual([
      "depend-on",
      "no-article-before-pronoun",
    ]);
  });

  it("reads a missing L1 Transfer flag as false", async () => {
    const { category, example, finding, patternKey } = fakeFindingEnrichment();
    const provider = anthropicAnswering(
      enrichmentAnswer([
        { category, example, finding, patternKey },
        fakeArticleEnrichment(),
      ])
    );

    const result = await Effect.runPromise(
      provider.enrichFindings(enrichmentInput)
    );

    expect(result.findings[0]?.l1Transfer).toBe(false);
  });

  it("throws AIResponseValidationError when a Finding gets no enrichment", async () => {
    const provider = anthropicAnswering(
      enrichmentAnswer([fakeFindingEnrichment()])
    );

    await expect(
      Effect.runPromise(provider.enrichFindings(enrichmentInput))
    ).rejects.toBeInstanceOf(AIResponseValidationError);
  });

  it("throws AIResponseValidationError when a Mistake Category does not map onto its Finding's Error Category", async () => {
    const provider = anthropicAnswering(
      enrichmentAnswer([
        { ...fakeFindingEnrichment(), category: "VOCABULARY" },
        fakeArticleEnrichment(),
      ])
    );

    await expect(
      Effect.runPromise(provider.enrichFindings(enrichmentInput))
    ).rejects.toBeInstanceOf(AIResponseValidationError);
  });

  it("throws AIResponseValidationError for a Mistake Category no Finding can take", async () => {
    const provider = anthropicAnswering(
      enrichmentAnswer([
        { ...fakeFindingEnrichment(), category: "LITERAL_TRANSLATION" },
        fakeArticleEnrichment(),
      ])
    );

    await expect(
      Effect.runPromise(provider.enrichFindings(enrichmentInput))
    ).rejects.toBeInstanceOf(AIResponseValidationError);
  });
});

describe("createAnthropicProvider.enrichFindings natural version and Naturalness Notes", () => {
  it("returns the natural version and the Naturalness Notes in the model's order", async () => {
    const provider = anthropicAnswering(
      enrichmentAnswer(
        [fakeFindingEnrichment(), fakeArticleEnrichment()],
        [
          fakeNaturalnessNote(),
          {
            ...fakeNaturalnessNote(),
            l1Transfer: false,
            naturalSpan: "it",
            originalSpan: "the it",
            patternKey: "bare-pronoun",
          },
        ]
      )
    );

    const result = await Effect.runPromise(
      provider.enrichFindings(enrichmentInput)
    );

    expect(result.naturalVersion).toBe("I rely on it.");
    expect(result.naturalnessNotes).toStrictEqual([
      {
        example: "I rely on my team.",
        explanation: "'Rely on' is what a fluent speaker would say here.",
        l1Transfer: true,
        naturalSpan: "I rely",
        originalSpan: "I depend",
        patternKey: "rely-on",
      },
      {
        example: "I rely on my team.",
        explanation: "'Rely on' is what a fluent speaker would say here.",
        l1Transfer: false,
        naturalSpan: "it",
        originalSpan: "the it",
        patternKey: "bare-pronoun",
      },
    ]);
  });

  it("reads a Naturalness Note's missing L1 Transfer flag as false", async () => {
    const { l1Transfer: _omitted, ...note } = fakeNaturalnessNote();
    const provider = anthropicAnswering(
      enrichmentAnswer(
        [fakeFindingEnrichment(), fakeArticleEnrichment()],
        [note]
      )
    );

    const result = await Effect.runPromise(
      provider.enrichFindings(enrichmentInput)
    );

    expect(result.naturalnessNotes[0]?.l1Transfer).toBe(false);
  });

  it("enriches a Writing Sample without Findings", async () => {
    const provider = anthropicAnswering(
      enrichmentAnswer([], [fakeNaturalnessNote()])
    );

    const result = await Effect.runPromise(
      provider.enrichFindings({
        findings: [],
        writingSample: "I depend on it.",
      })
    );

    expect(result.findings).toStrictEqual([]);
    expect(result.naturalVersion).toBe("I rely on it.");
    expect(result.naturalnessNotes).toHaveLength(1);
  });

  it("throws AIResponseValidationError without a natural version", async () => {
    const { naturalVersion: _omitted, ...answer } = enrichmentAnswer([
      fakeFindingEnrichment(),
      fakeArticleEnrichment(),
    ]);
    const provider = anthropicAnswering(answer);

    await expect(
      Effect.runPromise(provider.enrichFindings(enrichmentInput))
    ).rejects.toBeInstanceOf(AIResponseValidationError);
  });

  it("throws AIResponseValidationError for more than 50 Naturalness Notes", async () => {
    const provider = anthropicAnswering(
      enrichmentAnswer(
        [fakeFindingEnrichment(), fakeArticleEnrichment()],
        Array.from({ length: 51 }, fakeNaturalnessNote)
      )
    );

    await expect(
      Effect.runPromise(provider.enrichFindings(enrichmentInput))
    ).rejects.toBeInstanceOf(AIResponseValidationError);
  });
});

describe("testKey", () => {
  it("makes one 1-token request and resolves when the key works", async () => {
    const model = answering("anthropic.messages", "test-model", "Hi");

    await expect(Effect.runPromise(testKey(model))).resolves.toBeUndefined();
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(model.doGenerateCalls[0]).toEqual(
      expect.objectContaining({ maxOutputTokens: 1 })
    );
  });

  it("maps a 401 to AIKeyRejectedError and a 529 to AIProviderUnavailableError", async () => {
    await expect(
      Effect.runPromise(testKey(refusing("anthropic.messages", 401)))
    ).rejects.toBeInstanceOf(TrainerKeyRejectedError);
    await expect(
      Effect.runPromise(testKey(refusing("anthropic.messages", 529)))
    ).rejects.toBeInstanceOf(TrainerUnavailableError);
  });
});
