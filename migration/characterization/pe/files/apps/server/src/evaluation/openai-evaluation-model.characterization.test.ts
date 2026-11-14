// Characterization of apps/server/src/evaluation/openai-evaluation-model.ts at the PE baseline:
// what openai-evaluation-model.test.ts never sends back. A Suggestion whose alternative the
// provider answers as null, and an assessment with a property the schema does not declare.
import { describe, expect, it } from "bun:test";

import { ConfigProvider, Effect, Layer } from "effect";
import type { ClientOptions } from "openai";

import { EvaluationModel } from "./evaluation-model";
import { makeOpenRouterEvaluationModelLayer } from "./openai-evaluation-model";

// A completed Responses API envelope whose output text is `assessment`.
const answering =
  (assessment: unknown): NonNullable<ClientOptions["fetch"]> =>
  () =>
    Promise.resolve(
      Response.json({
        created_at: 1,
        id: "response-test",
        object: "response",
        output: [
          {
            content: [
              {
                annotations: [],
                text: JSON.stringify(assessment),
                type: "output_text",
              },
            ],
            id: "message-test",
            role: "assistant",
            status: "completed",
            type: "message",
          },
        ],
        status: "completed",
      })
    );

const evaluate = (
  providerFetch: NonNullable<ClientOptions["fetch"]>,
  writingSample: string
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const model = yield* EvaluationModel;
      return yield* model.evaluate(writingSample).pipe(Effect.result);
    }).pipe(
      Effect.provide(
        makeOpenRouterEvaluationModelLayer(providerFetch).pipe(
          Layer.provide(
            ConfigProvider.layer(
              ConfigProvider.fromEnvRecord({
                OPENROUTER_API_KEY: "private-test-key",
              })
            )
          )
        )
      )
    )
  );

describe("OpenRouter Evaluation Model guards", () => {
  it("drops a null alternative from a Suggestion", async () => {
    const result = await evaluate(
      answering({
        findings: [],
        nonEnglishSpans: [],
        suggestions: [
          {
            alternative: null,
            byteEnd: 8,
            byteStart: 4,
            explanation:
              "The original is not confirmed wrong; the intended speed determines the choice.",
            originalText: "fast",
          },
        ],
        summary: "One optional alternative.",
      }),
      "Use fast mode."
    );

    expect(result._tag).toBe("Success");
    expect(
      result._tag === "Success"
        ? (result.success.assessment as { suggestions: unknown[] }).suggestions
        : []
    ).toEqual([
      {
        byteEnd: 8,
        byteStart: 4,
        explanation:
          "The original is not confirmed wrong; the intended speed determines the choice.",
        originalText: "fast",
      },
    ]);
  });

  it("classifies an assessment with an undeclared property as a retryable invalid assessment", async () => {
    const result = await evaluate(
      answering({
        confidence: 0.9,
        findings: [],
        nonEnglishSpans: [],
        suggestions: [],
        summary: "No demonstrable English errors.",
      }),
      "Clear English writing."
    );

    expect(result._tag).toBe("Failure");
    expect(result._tag === "Failure" ? result.failure : undefined).toMatchObject(
      {
        _tag: "EvaluationModelError",
        kind: "invalid-assessment",
        recoverable: true,
      }
    );
  });
});
