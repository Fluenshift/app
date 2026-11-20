// What the Evaluation route answers for one Writing Sample: the created Evaluation, no English,
// or a typed failure with whether retrying can help. Ported from PE
// apps/server/src/evaluation/evaluation-endpoint.ts (5e831bb), with the result type that PE kept
// in app.ts.
import { Effect } from "effect";

import type { Evaluation } from "../history/learning-history";
import { evaluateWriting } from "./writing-evaluation";

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

/** Why the Judge could not evaluate a Writing Sample. */
export type WritingEvaluationFailure =
  ReturnType<typeof evaluateWriting> extends Effect.Effect<
    unknown,
    infer Failure,
    unknown
  >
    ? Failure
    : never;

/** What the Evaluation route answers when the Judge could not evaluate a Writing Sample. */
export const endpointFailure = (
  failure: WritingEvaluationFailure
): Exclude<EvaluationEndpointResult, { readonly kind: "created" }> => {
  switch (failure._tag) {
    case "NoEnglishError": {
      return { kind: "no-english" };
    }
    case "InvalidWritingSampleError": {
      return {
        code: "invalid-writing-sample",
        kind: "failure",
        retryable: false,
      };
    }
    case "EvaluationModelError": {
      return {
        code:
          failure.kind === "configuration"
            ? "configuration-missing"
            : failure.kind,
        kind: "failure",
        retryable: failure.recoverable,
      };
    }
    case "InvalidAssessmentError":
    case "UnsafeCorrectionError": {
      return {
        code: "invalid-assessment",
        kind: "failure",
        retryable: true,
      };
    }
    case "DatabaseError": {
      return {
        code: "persistence-failure",
        kind: "failure",
        retryable: true,
      };
    }
    default: {
      const exhaustiveFailure: never = failure;
      return exhaustiveFailure;
    }
  }
};

export const evaluateWritingForEndpoint = Effect.fn(
  "EvaluationEndpoint.evaluateWriting"
)(function* (writingSample: string, submittedAt: Date, now?: () => Date) {
  return yield* evaluateWriting(writingSample, submittedAt, now).pipe(
    Effect.match({
      onFailure: endpointFailure,
      onSuccess: (evaluation): EvaluationEndpointResult => ({
        evaluation,
        kind: "created",
      }),
    })
  );
});
