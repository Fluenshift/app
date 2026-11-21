// The Trainer key a hosted visitor brings (docs/adr/0012): its providers, the two request headers
// that carry it, and what a test of it finds, shared by the browser, which stores, sends and tests
// the key, and the server, which reads it. Ported from Grifando src/lib/aiCredentials.ts (74dbb9f).
import { Schema } from "effect";

/**
 * The providers a visitor's key may be for. Only an OpenRouter key runs the Judge, so it comes
 * first (docs/adr/0035).
 */
export const TRAINER_KEY_PROVIDERS = [
  "openrouter",
  "gemini",
  "anthropic",
] as const;

export type TrainerKeyProvider = (typeof TRAINER_KEY_PROVIDERS)[number];

export const TRAINER_PROVIDER_HEADER = "x-ai-provider";
export const TRAINER_KEY_HEADER = "x-ai-key";

export const isTrainerKeyProvider = (
  value: unknown
): value is TrainerKeyProvider =>
  TRAINER_KEY_PROVIDERS.some((provider) => provider === value);

/**
 * Body of `POST /api/ai-key/test` (Grifando's src/app/api/ai-key/test/route.ts): a key the
 * provider rejects is invalid, and a provider that cannot answer is busy, since the key may still
 * be fine.
 */
export const KeyTestResult = Schema.Struct({
  status: Schema.Literals(["works", "invalid", "busy"]),
});
export type KeyTestResult = typeof KeyTestResult.Type;
export type KeyTestStatus = KeyTestResult["status"];
