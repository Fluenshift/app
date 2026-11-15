// The Trainer's access errors, which the Learner can act on. Ported from Grifando
// src/server/ai/errors.ts (74dbb9f).
import { Schema } from "effect";

// The provider rejected the key.
export class TrainerKeyRejectedError extends Schema.TaggedError<
  TrainerKeyRejectedError,
  { readonly brand: unique symbol }
>()("TrainerKeyRejectedError", {}) {}

// The key has used up its quota for now.
export class TrainerQuotaExceededError extends Schema.TaggedError<
  TrainerQuotaExceededError,
  { readonly brand: unique symbol }
>()("TrainerQuotaExceededError", {}) {}

// The provider is busy; the Learner's text is kept and a retry may succeed.
export class TrainerUnavailableError extends Schema.TaggedError<
  TrainerUnavailableError,
  { readonly brand: unique symbol }
>()("TrainerUnavailableError", {}) {}

export type TrainerError =
  | TrainerKeyRejectedError
  | TrainerQuotaExceededError
  | TrainerUnavailableError;
