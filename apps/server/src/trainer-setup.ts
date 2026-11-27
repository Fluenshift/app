// The local profile's Trainer as /setup shows it (FR-24, #273): the provider and model of the key
// the server holds, or that it holds none.
import type { TrainerSetup } from "@grifando/contract";
import type { TrainerKey, TrainerModels, TrainerProvider } from "@grifando/env";
import { Option } from "effect";

const PROVIDER_NAMES: Readonly<Record<TrainerProvider, string>> = {
  anthropic: "Anthropic",
  gemini: "Gemini",
  openrouter: "OpenRouter",
};

export const trainerSetupOf = (settings: {
  readonly localKey: Option.Option<TrainerKey>;
  readonly models: Readonly<Record<TrainerProvider, TrainerModels>>;
}): TrainerSetup =>
  Option.match(settings.localKey, {
    onNone: (): TrainerSetup => ({ configured: false }),
    onSome: ({ provider }): TrainerSetup => ({
      configured: true,
      model: settings.models[provider].primary,
      provider: PROVIDER_NAMES[provider],
    }),
  });
