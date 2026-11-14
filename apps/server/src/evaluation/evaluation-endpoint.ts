// Typed stub for the red commit: every outcome reads as a persistence failure.
import { Effect } from "effect";

import type { Evaluation } from "../history/learning-history";

export type EvaluationFailureCode =
  | "configuration-missing"
  | "invalid-assessment"
  | "invalid-writing-sample"
  | "persistence-failure"
  | "provider-credits-exhausted"
  | "provider-output-incomplete"
  | "provider-rate-limited"
  | "provider-rejected"
  | "provider-timeout"
  | "provider-unavailable";

export type EvaluationEndpointResult =
  | { readonly evaluation: Evaluation; readonly kind: "created" }
  | { readonly kind: "no-english" }
  | {
      readonly code: EvaluationFailureCode;
      readonly kind: "failure";
      readonly retryable: boolean;
    };

const persistenceFailure = (): EvaluationEndpointResult => ({
  code: "persistence-failure",
  kind: "failure",
  retryable: true,
});

export const evaluateWritingForEndpoint = Effect.fn(
  "EvaluationEndpoint.evaluateWriting"
)(function* (_writingSample: string, _submittedAt: Date, _now?: () => Date) {
  yield* Effect.void;
  return persistenceFailure();
});
