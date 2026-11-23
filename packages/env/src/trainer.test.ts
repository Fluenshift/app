import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, Option, Redacted } from "effect";

import { TrainerConfig } from "./trainer";

const withEnv = (env: Record<string, string>) =>
  TrainerConfig.layer.pipe(
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(env)))
  );

const keyOf = (env: Record<string, string>) =>
  Effect.gen(function* () {
    const { localKey } = yield* TrainerConfig;
    return localKey.pipe(
      Option.map(({ apiKey, provider }) => ({
        apiKey: Redacted.value(apiKey),
        provider,
      }))
    );
  }).pipe(Effect.provide(withEnv(env)));

describe("TrainerConfig", () => {
  // OpenRouter's pins are Gemini's models under their OpenRouter ids (docs/adr/0035).
  it.effect("pins a primary and a fallback model for each provider", () =>
    Effect.gen(function* () {
      const { models } = yield* TrainerConfig;

      assert.deepStrictEqual(models, {
        anthropic: { fallback: "claude-haiku-5-5", primary: "claude-sonnet-5" },
        gemini: {
          fallback: "gemini-3.5-flash-lite",
          primary: "gemini-3.5-flash",
        },
        openrouter: {
          fallback: "google/gemini-3.5-flash-lite",
          primary: "google/gemini-3.5-flash",
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
          openrouter: {
            fallback: "google/gemini-3.5-flash-lite",
            primary: "google/gemini-3.5-flash",
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

  it.effect(
    "reads the local key of the provider AI_PROVIDER names, Anthropic otherwise",
    () =>
      Effect.gen(function* () {
        const { localKey } = yield* TrainerConfig;

        assert.deepStrictEqual(
          localKey.pipe(
            Option.map(({ apiKey, provider }) => ({
              apiKey: Redacted.value(apiKey),
              provider,
            }))
          ),
          Option.some({ apiKey: "k1", provider: "anthropic" })
        );
      }).pipe(
        Effect.provide(
          withEnv({ ANTHROPIC_API_KEY: " k1 ", GEMINI_API_KEY: "k2" })
        )
      )
  );

  it.effect("has no local key when the named provider's key is empty", () =>
    Effect.gen(function* () {
      const { localKey } = yield* TrainerConfig;

      assert.isTrue(Option.isNone(localKey));
    }).pipe(
      Effect.provide(
        withEnv({ AI_PROVIDER: "gemini", ANTHROPIC_API_KEY: "k1" })
      )
    )
  );

  it.effect("selects OpenRouter when AI_PROVIDER names it", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* keyOf({ AI_PROVIDER: "openrouter", OPENROUTER_API_KEY: "k" }),
        Option.some({ apiKey: "k", provider: "openrouter" })
      );
    })
  );

  it.effect("falls back to OpenRouter when it is the only key", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* keyOf({ OPENROUTER_API_KEY: "k" }),
        Option.some({ apiKey: "k", provider: "openrouter" })
      );
    })
  );

  it.effect(
    "keeps Anthropic when its key is set and AI_PROVIDER is empty",
    () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(
          yield* keyOf({ ANTHROPIC_API_KEY: "a", OPENROUTER_API_KEY: "k" }),
          Option.some({ apiKey: "a", provider: "anthropic" })
        );
      })
  );

  it.effect("keeps Gemini when AI_PROVIDER names it", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        yield* keyOf({
          AI_PROVIDER: "gemini",
          GEMINI_API_KEY: "g",
          OPENROUTER_API_KEY: "k",
        }),
        Option.some({ apiKey: "g", provider: "gemini" })
      );
    })
  );
});
