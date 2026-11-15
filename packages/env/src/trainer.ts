import { Config, Context, Effect, Layer } from "effect";

/** The providers a Trainer runs on (docs/adr/0012). */
export type TrainerProvider = "anthropic" | "gemini";

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

/**
 * The Trainer's model pins, moved here from Grifando src/server/ai/client.ts (74dbb9f) by
 * docs/adr/0012. Each provider has a primary model, which `ANTHROPIC_MODEL` or `GEMINI_MODEL`
 * may name, and a light fallback model, which the environment never changes. An empty variable
 * names no model.
 */
export class TrainerConfig extends Context.Service<
  TrainerConfig,
  { readonly models: Readonly<Record<TrainerProvider, TrainerModels>> }
>()("@fluenshift/env/TrainerConfig") {
  static readonly layer = Layer.effect(
    TrainerConfig,
    Effect.gen(function* () {
      const [anthropic, gemini] = yield* Config.all([
        Config.NonEmptyString("ANTHROPIC_MODEL").pipe(
          Config.withDefault(DEFAULT_ANTHROPIC_MODEL)
        ),
        Config.NonEmptyString("GEMINI_MODEL").pipe(
          Config.withDefault(DEFAULT_GEMINI_MODEL)
        ),
      ]);
      return TrainerConfig.of({
        models: {
          anthropic: { fallback: ANTHROPIC_FALLBACK_MODEL, primary: anthropic },
          gemini: { fallback: GEMINI_FALLBACK_MODEL, primary: gemini },
        },
      });
    })
  );
}
