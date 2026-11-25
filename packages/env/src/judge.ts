import { Config, Context, Effect, Layer, Option, Redacted } from "effect";

import { deployProfileConfig } from "./server";

/**
 * The Judge's credential for the local profile, which reads it from server configuration
 * (docs/adr/0012). An empty value counts as no credential. The hosted profile has none: its
 * Judge runs on each visitor's OpenRouter key, from the request (docs/adr/0035).
 */
export class JudgeConfig extends Context.Service<
  JudgeConfig,
  { readonly apiKey: Option.Option<Redacted.Redacted<string>> }
>()("@grifando/env/JudgeConfig") {
  static readonly layer = Layer.effect(
    JudgeConfig,
    Effect.gen(function* () {
      const profile = yield* deployProfileConfig;
      const apiKey = yield* Config.option(
        Config.Redacted("OPENROUTER_API_KEY")
      );
      return JudgeConfig.of({
        apiKey: apiKey.pipe(
          Option.filter(
            (key) => profile === "local" && Redacted.value(key).length > 0
          )
        ),
      });
    })
  );
}
