// The Trainer's access errors, which the Learner can act on. Ported from Grifando
// src/server/ai/errors.ts (74dbb9f).
import type { AIResponseValidationError } from "@grifando/contract";
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

// No key reached the request, and the profile offers none.
export class TrainerKeyRequiredError extends Schema.TaggedError<
  TrainerKeyRequiredError,
  { readonly brand: unique symbol }
>()("TrainerKeyRequiredError", {}) {}

// The key in the request is malformed: an unknown provider, over 256 characters, or not
// printable ASCII.
export class InvalidTrainerCredentialsError extends Schema.TaggedError<
  InvalidTrainerCredentialsError,
  { readonly brand: unique symbol }
>()("InvalidTrainerCredentialsError", {}) {}

// The errors a Learner can act on: set up, check or replace the key, or retry later.
export type TrainerAccessError =
  | InvalidTrainerCredentialsError
  | TrainerKeyRejectedError
  | TrainerKeyRequiredError
  | TrainerQuotaExceededError
  | TrainerUnavailableError;

// A failure of one Trainer call; an answer that its schema refuses is an
// AIResponseValidationError.
export type TrainerError =
  | AIResponseValidationError
  | TrainerKeyRejectedError
  | TrainerQuotaExceededError
  | TrainerUnavailableError;
