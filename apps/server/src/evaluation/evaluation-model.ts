// The Judge's boundary: the service that assesses one Writing Sample and answers with the
// structured assessment and its usage. Ported from the service part of PE
// apps/server/src/evaluation/evaluation-model.ts (5e831bb); the assessment schema lives in
// packages/core. The Judge on the AI SDK implements this service in Phase 4c.
import type { AssessmentSpan } from "@fluenshift/core/model-assessment";
import { Context, Layer, Schema } from "effect";
import type { Effect, Redacted } from "effect";

export interface ModelEvaluation {
  readonly assessment: unknown;
  readonly inputTokens?: number;
  readonly latencyMilliseconds: number;
  readonly model: string;
  readonly outputTokens?: number;
  readonly provider: string;
}

export class EvaluationModelError extends Schema.TaggedError<
  EvaluationModelError,
  { readonly brand: unique symbol }
>()("EvaluationModelError", {
  kind: Schema.Literals([
    "configuration",
    "invalid-assessment",
    "provider-credits-exhausted",
    "provider-output-incomplete",
    "provider-rate-limited",
    "provider-rejected",
    "provider-timeout",
    "provider-unavailable",
  ]),
  reason: Schema.String,
  recoverable: Schema.Boolean,
}) {}

/**
 * The visitor's OpenRouter key for one request, on which the hosted profile's Judge runs
 * (docs/adr/0035). The route that runs the Judge provides it from the request; nothing keeps it.
 */
export class JudgeKey extends Context.Service<
  JudgeKey,
  { readonly apiKey: Redacted.Redacted<string> }
>()("server/JudgeKey") {}

/** A hosted request that runs the Judge carries no OpenRouter key (docs/adr/0035). */
export class JudgeKeyRequiredError extends Schema.TaggedError<
  JudgeKeyRequiredError,
  { readonly brand: unique symbol }
>()("JudgeKeyRequiredError", {}) {}

export class EvaluationModel extends Context.Service<
  EvaluationModel,
  {
    readonly configured: boolean;
    readonly evaluate: (
      writingSample: string,
      protectedSpans?: readonly AssessmentSpan[]
    ) => Effect.Effect<ModelEvaluation, EvaluationModelError>;
    readonly model: string;
    readonly provider: string;
  }
>()("server/EvaluationModel") {
  /** A model that answers with `evaluate`, for tests that must not call a provider. */
  static fake(
    evaluate: (
      writingSample: string,
      protectedSpans?: readonly AssessmentSpan[]
    ) => Effect.Effect<ModelEvaluation, EvaluationModelError>
  ) {
    return Layer.succeed(
      EvaluationModel,
      EvaluationModel.of({
        configured: true,
        evaluate,
        model: "deterministic-test-model",
        provider: "test",
      })
    );
  }
}
