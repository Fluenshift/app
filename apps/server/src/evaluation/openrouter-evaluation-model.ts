// Typed stub for the red commit: every evaluation fails as unavailable and no provider is called.
import { Effect, Layer } from "effect";

import { EvaluationModel, EvaluationModelError } from "./evaluation-model";

export const makeOpenRouterEvaluationModelLayer = (
  _providerFetch?: typeof globalThis.fetch,
  _maxRetries = 0
) =>
  Layer.succeed(
    EvaluationModel,
    EvaluationModel.of({
      configured: true,
      evaluate: () =>
        Effect.fail(
          new EvaluationModelError({
            kind: "provider-unavailable",
            reason: "Not ported yet",
            recoverable: false,
          })
        ),
      model: "",
      provider: "",
    })
  );

export const OpenRouterEvaluationModelLive =
  makeOpenRouterEvaluationModelLayer();
