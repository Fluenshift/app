// The Trainer's resilience: one fallback, only on overload (docs/adr/0012). Ported from Grifando
// src/server/ai/resilient.ts (74dbb9f). A call goes to the primary model with a time limit; when
// that model is overloaded or times out, the same call goes once to the fallback model; when the
// fallback is overloaded or times out too, the call fails as unavailable. Any other failure
// passes through untouched, and a call that times out is interrupted.
import { Cause, Effect } from "effect";
import type { Duration } from "effect";

import { TrainerUnavailableError } from "./trainer-errors";
import type { TrainerError } from "./trainer-errors";
import type { TrainerMethods } from "./trainer-model";

const OVERLOAD_STATUSES = new Set([503, 529]);

const hasOverloadShape = (value: unknown): boolean => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const { status } = record;
  if (typeof status === "number" && OVERLOAD_STATUSES.has(status)) {
    return true;
  }
  if (status === "UNAVAILABLE") {
    return true;
  }
  if (record["type"] === "overloaded_error") {
    return true;
  }
  return hasOverloadShape(record["error"]);
};

// True only for "the provider is busy or slow" failures worth one call to the fallback model.
// Key, quota and validation errors never match.
export const isOverloaded = (error: unknown): boolean =>
  error instanceof TrainerUnavailableError ||
  Cause.isTimeoutError(error) ||
  hasOverloadShape(error);

// The failures that send a call to the fallback model: an overload or a timeout.
const isOverloadOrTimeout = (
  error: TrainerError | Cause.TimeoutError
): error is Cause.TimeoutError | TrainerUnavailableError => isOverloaded(error);

const withFallback = <A>(
  primary: Effect.Effect<A, TrainerError>,
  fallback: () => Effect.Effect<A, TrainerError>,
  timeout: Duration.Input
): Effect.Effect<A, TrainerError> =>
  primary.pipe(
    Effect.timeout(timeout),
    Effect.catchIf(isOverloadOrTimeout, () =>
      fallback().pipe(
        Effect.timeout(timeout),
        Effect.mapError((fallbackError) =>
          isOverloadOrTimeout(fallbackError)
            ? new TrainerUnavailableError()
            : fallbackError
        )
      )
    )
  );

export const withResilience = (
  primary: TrainerMethods,
  fallback: TrainerMethods,
  { timeout }: { readonly timeout: Duration.Input }
): TrainerMethods => ({
  continueInterview: (history) =>
    withFallback(
      primary.continueInterview(history),
      () => fallback.continueInterview(history),
      timeout
    ),
  enrichFindings: (input) => primary.enrichFindings(input),
  explainAttempt: (input) =>
    withFallback(
      primary.explainAttempt(input),
      () => fallback.explainAttempt(input),
      timeout
    ),
  generateExercises: (targets) =>
    withFallback(
      primary.generateExercises(targets),
      () => fallback.generateExercises(targets),
      timeout
    ),
});
