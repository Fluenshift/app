import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer } from "effect";

import { TrainerConfig } from "./trainer";

const withEnv = (env: Record<string, string>) =>
  TrainerConfig.layer.pipe(
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(env)))
  );

describe("TrainerConfig", () => {
  it.effect("pins a primary and a fallback model for each provider", () =>
    Effect.gen(function* () {
      const { models } = yield* TrainerConfig;

      assert.deepStrictEqual(models, {
        anthropic: { fallback: "claude-haiku-5-5", primary: "claude-sonnet-5" },
        gemini: {
          fallback: "gemini-3.5-flash-lite",
          primary: "gemini-3.5-flash",
        },
      });
    }).pipe(Effect.provide(withEnv({})))
  );

  it.effect(
    "lets the environment name a provider's primary model, never its fallback",
    () =>
      Effect.gen(function* () {
        const { models } = yield* TrainerConfig;

        assert.deepStrictEqual(models, {
          anthropic: { fallback: "claude-haiku-5-5", primary: "claude-opus-5" },
          gemini: {
            fallback: "gemini-3.5-flash-lite",
            primary: "gemini-3.8-flash",
          },
        });
      }).pipe(
        Effect.provide(
          withEnv({
            ANTHROPIC_MODEL: "claude-opus-5",
            GEMINI_MODEL: "gemini-3.8-flash",
          })
        )
      )
  );

  it.effect("keeps the pinned model when a variable is empty", () =>
    Effect.gen(function* () {
      const { models } = yield* TrainerConfig;

      assert.strictEqual(models.anthropic.primary, "claude-sonnet-5");
      assert.strictEqual(models.gemini.primary, "gemini-3.5-flash");
    }).pipe(Effect.provide(withEnv({ ANTHROPIC_MODEL: "", GEMINI_MODEL: "" })))
  );
});
