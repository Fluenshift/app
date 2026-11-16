// Ported from Grifando src/server/ai/providers/gemini.test.ts (74dbb9f). Grifando faked the
// Gemini SDK's generateContent; on the AI SDK one Trainer serves every provider, so each case gives
// it a mock Gemini model that answers the JSON text, and the key check reads the call that
// reached the model. The analyzeWriting cases are superseded (docs/adr/0004).
import { AIResponseValidationError } from "@fluenshift/contract";
import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";

import { createAiSdkTrainer, testKey, toGeminiSchema } from "./ai-sdk-trainer";
import {
  TrainerKeyRejectedError,
  TrainerQuotaExceededError,
} from "./trainer-errors";
import {
  answering,
  enrichmentInput,
  explainInput,
  fakeArticleEnrichment,
  fakeFindingEnrichment,
  fakeMultipleChoiceExercise,
  oneTarget,
  refusing,
} from "./trainer-test-models";

const geminiAnswering = (json: unknown) =>
  createAiSdkTrainer(
    answering("google.generative-ai", "test-model", JSON.stringify(json))
  );

describe("createGeminiProvider.generateExercises", () => {
  it("returns the validated exercises for well-formed JSON", async () => {
    const provider = geminiAnswering({
      exercises: [fakeMultipleChoiceExercise()],
    });

    const result = await Effect.runPromise(
      provider.generateExercises(oneTarget)
    );

    expect(result.exercises).toHaveLength(1);
    expect(result.exercises[0]?.type).toBe("MULTIPLE_CHOICE");
  });

  it("throws AIResponseValidationError when the exercise count doesn't match", async () => {
    const provider = geminiAnswering({ exercises: [] });

    await expect(
      Effect.runPromise(provider.generateExercises(oneTarget))
    ).rejects.toBeInstanceOf(AIResponseValidationError);
  });
});

describe("createGeminiProvider.continueInterview", () => {
  it("returns the validated next question", async () => {
    const provider = geminiAnswering({
      question: "Tell me about a project you're proud of.",
    });

    const result = await Effect.runPromise(provider.continueInterview([]));

    expect(result.question).toBe("Tell me about a project you're proud of.");
  });
});

describe("createGeminiProvider.explainAttempt", () => {
  it("returns the validated explanation", async () => {
    const provider = geminiAnswering({
      explanation: "'Depend' is followed by 'on', not 'of'.",
    });

    const result = await Effect.runPromise(
      provider.explainAttempt(explainInput)
    );

    expect(result.explanation).toContain("'on'");
  });

  it("throws AIResponseValidationError on an invalid response", async () => {
    const provider = geminiAnswering({ explanation: "" });

    await expect(
      Effect.runPromise(provider.explainAttempt(explainInput))
    ).rejects.toBeInstanceOf(AIResponseValidationError);
  });
});

describe("createGeminiProvider.enrichFindings", () => {
  it("returns each Finding's enrichment for well-formed JSON", async () => {
    const provider = geminiAnswering({
      findings: [fakeFindingEnrichment(), fakeArticleEnrichment()],
    });

    const result = await Effect.runPromise(
      provider.enrichFindings(enrichmentInput)
    );

    expect(result.findings.map((finding) => finding.category)).toStrictEqual([
      "PREPOSITIONS",
      "ARTICLES",
    ]);
    expect(result.model).toBe("test-model");
  });

  it("offers the model only the Mistake Categories a Finding can take", async () => {
    const model = answering(
      "google.generative-ai",
      "test-model",
      JSON.stringify({
        findings: [fakeFindingEnrichment(), fakeArticleEnrichment()],
      })
    );

    await Effect.runPromise(
      createAiSdkTrainer(model).enrichFindings(enrichmentInput)
    );

    const sent = JSON.stringify(model.doGenerateCalls[0]?.responseFormat);
    expect(sent).toContain('"COUNTABLE_UNCOUNTABLE"');
    expect(sent).not.toContain("UNNATURAL_PHRASING");
    expect(sent).not.toContain("LITERAL_TRANSLATION");
    expect(sent).not.toMatch(/maxItems|minItems|\$schema/u);
  });

  it("throws AIResponseValidationError when two entries name the same Finding", async () => {
    const provider = geminiAnswering({
      findings: [
        fakeFindingEnrichment(),
        { ...fakeFindingEnrichment(), example: "We depend on you." },
      ],
    });

    await expect(
      Effect.runPromise(provider.enrichFindings(enrichmentInput))
    ).rejects.toBeInstanceOf(AIResponseValidationError);
  });
});

describe("testKey", () => {
  it("makes one 1-token request and resolves when the key works", async () => {
    const model = answering("google.generative-ai", "test-model", "");

    await expect(Effect.runPromise(testKey(model))).resolves.toBeUndefined();
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(model.doGenerateCalls[0]).toEqual(
      expect.objectContaining({ maxOutputTokens: 1 })
    );
  });

  it("maps an invalid-key 400 to AIKeyRejectedError and a 429 to AIQuotaExceededError", async () => {
    await expect(
      Effect.runPromise(
        testKey(refusing("google.generative-ai", 400, "API key not valid"))
      )
    ).rejects.toBeInstanceOf(TrainerKeyRejectedError);
    await expect(
      Effect.runPromise(testKey(refusing("google.generative-ai", 429, "quota")))
    ).rejects.toBeInstanceOf(TrainerQuotaExceededError);
  });
});

describe("toGeminiSchema", () => {
  it("drops array bounds and $schema that Gemini rejects, keeping the rest", () => {
    const json = JSON.stringify(
      toGeminiSchema(
        Schema.Struct({
          items: Schema.Array(Schema.String.check(Schema.isMaxLength(5))).check(
            Schema.isMinLength(1),
            Schema.isMaxLength(50)
          ),
        })
      )
    );
    expect(json).not.toMatch(/maxItems|minItems|\$schema/u);
    expect(json).toContain('"maxLength":5');
  });
});
