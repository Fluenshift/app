import { Config, Context, Effect, Layer, Option, Redacted } from "effect";

/**
 * The Judge's credential for the local profile, which reads it from server configuration
 * (docs/adr/0012). An empty value counts as no credential. The hosted profile takes the
 * visitor's key from request headers instead (Phase 6).
 */
export class JudgeConfig extends Context.Service<
  JudgeConfig,
  { readonly apiKey: Option.Option<Redacted.Redacted<string>> }
>()("@fluenshift/env/JudgeConfig") {
  static readonly layer = Layer.effect(
    JudgeConfig,
    Effect.gen(function* () {
      const apiKey = yield* Config.option(
        Config.Redacted("OPENROUTER_API_KEY")
      );
      return JudgeConfig.of({
        apiKey: apiKey.pipe(
          Option.filter((key) => Redacted.value(key).length > 0)
        ),
      });
    })
  );
}
