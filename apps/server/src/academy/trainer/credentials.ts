// Where a Trainer's key comes from (docs/adr/0012): the Learner's request headers and, in the
// local profile only, the key in server configuration. Ported from Grifando
// src/server/ai/credentials.ts, src/lib/aiCredentials.ts and src/server/ai/aiErrorResponse.ts
// (74dbb9f).
import { ServerConfig, TrainerConfig } from "@fluenshift/env";
import type { TrainerProvider } from "@fluenshift/env";
import { Effect, Option, Redacted } from "effect";

import type { EdgeFailure } from "../../edge";
import type { TrainerCredentials } from "./trainer-client";
import { InvalidTrainerCredentialsError } from "./trainer-errors";
import type { TrainerAccessError } from "./trainer-errors";

export const TRAINER_PROVIDER_HEADER = "x-ai-provider";
export const TRAINER_KEY_HEADER = "x-ai-key";

const MAX_KEY_LENGTH = 256;
const PRINTABLE_ASCII = /^[\u0021-\u007E]+$/u;

const isTrainerProvider = (value: string): value is TrainerProvider =>
  value === "gemini" || value === "anthropic";

// The key the request carries, or null when it carries none. A malformed key fails instead, so
// that the Learner can fix it in Settings.
export const readTrainerCredentials = Effect.fn("TrainerCredentials.read")(
  function* (headers: Headers) {
    const provider = headers.get(TRAINER_PROVIDER_HEADER)?.trim() ?? "";
    const apiKey = headers.get(TRAINER_KEY_HEADER)?.trim() ?? "";
    if (provider === "" || apiKey === "") {
      return null;
    }
    if (
      !isTrainerProvider(provider) ||
      apiKey.length > MAX_KEY_LENGTH ||
      !PRINTABLE_ASCII.test(apiKey)
    ) {
      return yield* new InvalidTrainerCredentialsError();
    }
    const credentials: TrainerCredentials = {
      apiKey: Redacted.make(apiKey),
      provider,
    };
    return credentials;
  }
);

// The request's key first. Only the local profile falls back to the key in its configuration;
// the hosted profile never has one.
export const resolveTrainerCredentials = Effect.fn(
  "TrainerCredentials.resolve"
)(function* (headers: Headers) {
  const fromHeaders = yield* readTrainerCredentials(headers);
  if (fromHeaders !== null) {
    return fromHeaders;
  }
  const { profile } = yield* ServerConfig;
  if (profile === "hosted") {
    return null;
  }
  const { localKey } = yield* TrainerConfig;
  return Option.getOrNull(localKey);
});

// What each access error answers. The Learner reads the message, which never includes the key.
const FAILURES = {
  InvalidTrainerCredentialsError: {
    code: "AI_KEY_INVALID",
    error: "That AI key doesn't look right. Check it in Settings.",
    status: 400,
  },
  TrainerKeyRejectedError: {
    code: "AI_KEY_REJECTED",
    error: "Your AI provider rejected this key. Check it in Settings.",
    status: 401,
  },
  TrainerKeyRequiredError: {
    code: "AI_KEY_REQUIRED",
    error: "Set up your AI key to get feedback.",
    status: 401,
  },
  TrainerQuotaExceededError: {
    code: "AI_QUOTA_EXCEEDED",
    error:
      "Your AI key has used up its quota for now. Try again later or use another key.",
    status: 429,
  },
  TrainerUnavailableError: {
    code: "AI_UNAVAILABLE",
    error:
      "The AI provider is busy right now. Your text is saved — try again in a minute.",
    status: 503,
  },
} as const satisfies Record<
  TrainerAccessError["_tag"],
  { readonly code: string; readonly error: string; readonly status: number }
>;

const isTrainerAccessError = (error: unknown): error is TrainerAccessError =>
  typeof error === "object" &&
  error !== null &&
  "_tag" in error &&
  typeof error._tag === "string" &&
  Object.hasOwn(FAILURES, error._tag);

// What a route answers for an error the Learner can act on.
export const trainerFailure = (error: TrainerAccessError): EdgeFailure => {
  const { status, ...body } = FAILURES[error._tag];
  return { body, status };
};

// The response for an error the Learner can act on, or null for any other error.
export const trainerErrorResponse = (error: unknown): Response | null => {
  if (!isTrainerAccessError(error)) {
    return null;
  }
  const { body, status } = trainerFailure(error);
  return Response.json(body, { status });
};
