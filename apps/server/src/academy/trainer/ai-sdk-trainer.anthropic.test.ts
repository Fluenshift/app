// Ported from Grifando src/server/ai/providers/anthropic.test.ts (74dbb9f). Grifando faked the
// Anthropic SDK's messages client; on the AI SDK one Trainer serves every provider, so each case
// gives it a mock Anthropic model that answers what the tool_use block carried, or no object at
// all. The analyzeWriting cases are superseded (docs/adr/0004).
import { AIResponseValidationError } from "@fluenshift/contract";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createAiSdkTrainer } from "./ai-sdk-trainer";
import {
  answering,
  explainInput,
  fakeMultipleChoiceExercise,
  oneTarget,
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
