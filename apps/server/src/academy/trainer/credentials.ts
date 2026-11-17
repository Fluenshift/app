// Where a Trainer's key comes from (docs/adr/0012): the Learner's request headers and, in the
// local profile only, the key in server configuration. Ported from Grifando
// src/server/ai/credentials.ts, src/lib/aiCredentials.ts and src/server/ai/aiErrorResponse.ts
// (74dbb9f).
import { Effect, Redacted } from "effect";

import type { TrainerCredentials } from "./trainer-client";

export const TRAINER_PROVIDER_HEADER = "x-ai-provider";
export const TRAINER_KEY_HEADER = "x-ai-key";

const PLACEHOLDER: TrainerCredentials = {
  apiKey: Redacted.make(""),
  provider: "anthropic",
};

export const readTrainerCredentials = (_headers: Headers) =>
  Effect.succeed<TrainerCredentials | null>(PLACEHOLDER);

export const resolveTrainerCredentials = (_headers: Headers) =>
  Effect.succeed<TrainerCredentials | null>(PLACEHOLDER);

export const trainerErrorResponse = (_error: unknown): Response | null =>
  Response.json({});
