import { Config, Context, Effect, Layer, Option, Redacted } from "effect";

/** The providers a Trainer runs on (docs/adr/0012, docs/adr/0035). */
export type TrainerProvider = "anthropic" | "gemini" | "openrouter";

/** A key for one provider. */
export interface TrainerKey {
  readonly apiKey: Redacted.Redacted<string>;
  readonly provider: TrainerProvider;
}

/** The model that answers a provider's calls, and the one that takes over on overload. */
export interface TrainerModels {
  readonly fallback: string;
  readonly primary: string;
}

// Exact model ids, never a `-latest` alias.
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5";
// gemini-3.8-flash measured ~88s per call (Nov 2026), past the Trainer's 60-second limit; 3.5
// Flash answers in ~5s. Measure again before moving to a newer model.
const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
const ANTHROPIC_FALLBACK_MODEL = "claude-haiku-5-5";
// Lightest current Flash text model; no 3.8 Flash-Lite exists (Google model docs).
const GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite";
// Gemini's pins under their OpenRouter ids, so an OpenRouter key runs the same Trainer
// (docs/adr/0035). Both support structured outputs in OpenRouter's public model list (Nov 2026).
const OPENROUTER_MODEL = "google/gemini-3.5-flash";
const OPENROUTER_FALLBACK_MODEL = "google/gemini-3.5-flash-lite";

const nonEmpty = (key: Option.Option<Redacted.Redacted<string>>) =>
  key.pipe(
    Option.map((value) => Redacted.value(value).trim()),
    Option.filter((value) => value.length > 0)
  );

const providerOf = (
  aiProvider: string,
  keys: Readonly<Record<TrainerProvider, Option.Option<string>>>
): TrainerProvider => {
  if (aiProvider === "gemini" || aiProvider === "openrouter") {
    return aiProvider;
  }
  // OK-02: OpenRouter only when it is the sole key.
  return Option.isNone(keys.anthropic) &&
    Option.isNone(keys.gemini) &&
    Option.isSome(keys.openrouter)
    ? "openrouter"
    : "anthropic";
};

/**
 * The Trainer's model pins, moved here from Grifando src/server/ai/client.ts (74dbb9f) by
 * docs/adr/0012. Each provider has a primary model, which `ANTHROPIC_MODEL` or `GEMINI_MODEL`
 * may name, and a light fallback model, which the environment never changes. An empty variable
 * names no model. OpenRouter's pins, for a visitor's OpenRouter key, are fixed (docs/adr/0035).
 */
export class TrainerConfig extends Context.Service<
  TrainerConfig,
  {
    /** The local profile's key, from server configuration (docs/adr/0012). */
    readonly localKey: Option.Option<TrainerKey>;
    readonly models: Readonly<Record<TrainerProvider, TrainerModels>>;
  }
>()("@grifando/env/TrainerConfig") {
  static readonly layer = Layer.effect(
    TrainerConfig,
    Effect.gen(function* () {
      const [
        anthropic,
        gemini,
        aiProvider,
        anthropicKey,
        geminiKey,
        openrouterKey,
      ] = yield* Config.all([
        Config.NonEmptyString("ANTHROPIC_MODEL").pipe(
          Config.withDefault(DEFAULT_ANTHROPIC_MODEL)
        ),
        Config.NonEmptyString("GEMINI_MODEL").pipe(
          Config.withDefault(DEFAULT_GEMINI_MODEL)
        ),
        Config.String("AI_PROVIDER").pipe(Config.withDefault("")),
        Config.option(Config.Redacted("ANTHROPIC_API_KEY")),
        Config.option(Config.Redacted("GEMINI_API_KEY")),
        Config.option(Config.Redacted("OPENROUTER_API_KEY")),
      ]);
      // As Grifando's development keys did: Gemini or OpenRouter when AI_PROVIDER names it.
      // With it empty, OpenRouter only when it is the sole key, else Anthropic (OK-02).
      const keys = {
        anthropic: nonEmpty(anthropicKey),
        gemini: nonEmpty(geminiKey),
        openrouter: nonEmpty(openrouterKey),
      };
      const provider = providerOf(aiProvider, keys);
      const localKey = keys[provider].pipe(
        Option.map((key): TrainerKey => ({
          apiKey: Redacted.make(key),
          provider,
        }))
      );
      return TrainerConfig.of({
        localKey,
        models: {
          anthropic: { fallback: ANTHROPIC_FALLBACK_MODEL, primary: anthropic },
          gemini: { fallback: GEMINI_FALLBACK_MODEL, primary: gemini },
          openrouter: {
            fallback: OPENROUTER_FALLBACK_MODEL,
            primary: OPENROUTER_MODEL,
          },
        },
      });
    })
  );
}
