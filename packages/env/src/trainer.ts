import { Context, Layer } from "effect";

/** The providers a Trainer runs on (docs/adr/0012). */
export type TrainerProvider = "anthropic" | "gemini";

/** The model that answers a provider's calls, and the one that takes over on overload. */
export interface TrainerModels {
  readonly fallback: string;
  readonly primary: string;
}

/**
 * The Trainer's model pins (docs/adr/0012).
 */
export class TrainerConfig extends Context.Service<
  TrainerConfig,
  { readonly models: Readonly<Record<TrainerProvider, TrainerModels>> }
>()("@fluenshift/env/TrainerConfig") {
  static readonly layer = Layer.succeed(
    TrainerConfig,
    TrainerConfig.of({
      models: {
        anthropic: { fallback: "", primary: "" },
        gemini: { fallback: "", primary: "" },
      },
    })
  );
}
