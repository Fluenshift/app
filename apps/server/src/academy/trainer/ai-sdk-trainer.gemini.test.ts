// Ported from Grifando src/server/ai/providers/gemini.test.ts (74dbb9f). Grifando faked the
// Gemini SDK's generateContent; on the AI SDK one Trainer serves every provider, so each case gives
// it a mock Gemini model that answers the JSON text. The analyzeWriting cases are superseded
// (docs/adr/0004).
import { AIResponseValidationError } from "@fluenshift/contract";
import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";

import { createAiSdkTrainer, toGeminiSchema } from "./ai-sdk-trainer";
import {
  answering,
  explainInput,
  fakeMultipleChoiceExercise,
  oneTarget,
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
