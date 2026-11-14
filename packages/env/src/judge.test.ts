import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, Option, Redacted } from "effect";

import { JudgeConfig } from "./judge";

const withEnv = (env: Record<string, string>) =>
  JudgeConfig.layer.pipe(
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(env)))
  );

describe("JudgeConfig", () => {
  it.effect("reads the OpenRouter key as a redacted value", () =>
    Effect.gen(function* () {
      const { apiKey } = yield* JudgeConfig;

      assert.strictEqual(
        apiKey.pipe(Option.map(Redacted.value), Option.getOrUndefined),
        "private-test-key"
      );
      assert.notInclude(
        String(Option.getOrUndefined(apiKey)),
        "private-test-key"
      );
    }).pipe(Effect.provide(withEnv({ OPENROUTER_API_KEY: "private-test-key" })))
  );

  it.effect("has no key when the variable is missing or empty", () =>
    Effect.gen(function* () {
      const missing = yield* Effect.provide(JudgeConfig, withEnv({}));
      const empty = yield* Effect.provide(
        JudgeConfig,
        withEnv({ OPENROUTER_API_KEY: "" })
      );

      assert.isTrue(Option.isNone(missing.apiKey));
      assert.isTrue(Option.isNone(empty.apiKey));
    })
  );
});
