// The local profile's Trainer as /setup shows it (FR-24, #273).
import type { TrainerModels, TrainerProvider } from "@grifando/env";
import { Option, Redacted } from "effect";
import { describe, expect, it } from "vitest";

import { trainerSetupOf } from "./trainer-setup";

const models: Readonly<Record<TrainerProvider, TrainerModels>> = {
  anthropic: { fallback: "claude-haiku", primary: "claude-sonnet-5" },
  gemini: { fallback: "gemini-lite", primary: "gemini-3.5-flash" },
  openrouter: { fallback: "or-lite", primary: "or-flash" },
};

describe("trainerSetupOf", () => {
  it("names the provider and primary model of the key the server holds", () => {
    const anthropic = trainerSetupOf({
      localKey: Option.some({
        apiKey: Redacted.make("key"),
        provider: "anthropic",
      }),
      models,
    });
    const gemini = trainerSetupOf({
      localKey: Option.some({
        apiKey: Redacted.make("key"),
        provider: "gemini",
      }),
      models,
    });

    expect(anthropic).toStrictEqual({
      configured: true,
      model: "claude-sonnet-5",
      provider: "Anthropic",
    });
    expect(gemini).toStrictEqual({
      configured: true,
      model: "gemini-3.5-flash",
      provider: "Gemini",
    });
  });

  it("says when the server holds no Trainer key", () => {
    expect(trainerSetupOf({ localKey: Option.none(), models })).toStrictEqual({
      configured: false,
    });
  });
});
