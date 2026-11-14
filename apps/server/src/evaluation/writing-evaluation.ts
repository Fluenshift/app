// Typed stub for the red commit: no Writing Sample is evaluated yet.
import { Effect, Schema } from "effect";

import type { Evaluation } from "../history/learning-history";

export class InvalidWritingSampleError extends Schema.TaggedError<
  InvalidWritingSampleError,
  { readonly brand: unique symbol }
>()("InvalidWritingSampleError", { reason: Schema.String }) {}

export class NoEnglishError extends Schema.TaggedError<
  NoEnglishError,
  { readonly brand: unique symbol }
>()("NoEnglishError", { reason: Schema.String }) {}

class NotPortedError extends Schema.TaggedError<
  NotPortedError,
  { readonly brand: unique symbol }
>()("NotPortedError", {}) {}

const notPorted = (): Effect.Effect<Evaluation, NotPortedError> =>
  Effect.fail(new NotPortedError());

export const evaluateWriting = Effect.fn("WritingEvaluation.evaluate")(
  function* (_writingSample: string, _submittedAt: Date, _now?: () => Date) {
    return yield* notPorted();
  }
);
