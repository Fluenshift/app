// The Trainer key a hosted visitor brings (docs/adr/0012): its providers and the two request
// headers that carry it, shared by the browser, which stores and sends the key, and the server,
// which reads it. Ported from Grifando src/lib/aiCredentials.ts (74dbb9f).

/** The providers a visitor's key may be for. */
export const TRAINER_KEY_PROVIDERS = ["gemini", "anthropic"] as const;

export type TrainerKeyProvider = (typeof TRAINER_KEY_PROVIDERS)[number];

export const TRAINER_PROVIDER_HEADER = "x-ai-provider";
export const TRAINER_KEY_HEADER = "x-ai-key";

export const isTrainerKeyProvider = (
  value: unknown
): value is TrainerKeyProvider => value === "gemini" || value === "anthropic";
