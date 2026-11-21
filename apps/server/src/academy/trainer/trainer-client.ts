// Which model answers the Trainer's calls, and the key test (docs/adr/0012). Ported from Grifando
// src/server/ai/client.ts (74dbb9f), which built an Anthropic or a Gemini SDK client: here the
// AI SDK's provider for the key's provider gives the models, OpenRouter's among them
// (docs/adr/0035), and the model pins live in Trainer Config. A Trainer is built for one key and
// one request, and nothing keeps the key.
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { TrainerConfig } from "@fluenshift/env";
import type { TrainerProvider } from "@fluenshift/env";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { Context, Effect, Layer, Redacted } from "effect";

import { createAiSdkTrainer, testKey } from "./ai-sdk-trainer";
import { withResilience } from "./resilience";
import type { TrainerMethods } from "./trainer-model";

const TRAINER_TIMEOUT = "60 seconds";
const KEY_TEST_TIMEOUT = "15 seconds";

/** One Learner's key for one provider. */
export interface TrainerCredentials {
  readonly apiKey: Redacted.Redacted<string>;
  readonly provider: TrainerProvider;
}

// A rejected key reads as "invalid". Exhausted quota, overload, a provider that does not answer
// in time and anything unexpected read as "busy": the key may still be fine.
export type KeyTestStatus = "busy" | "invalid" | "works";

type ProviderFetch = typeof globalThis.fetch;

// The models of the key's provider, by model id. Each provider instance holds one key.
const modelsOf = (
  { apiKey, provider }: TrainerCredentials,
  providerFetch: ProviderFetch | undefined
): ((modelId: string) => LanguageModel) => {
  const settings = {
    apiKey: Redacted.value(apiKey),
    ...(providerFetch === undefined ? {} : { fetch: providerFetch }),
  };
  if (provider === "openrouter") {
    return createOpenRouter(settings);
  }
  return provider === "gemini"
    ? createGoogle(settings)
    : createAnthropic(settings);
};

export class TrainerClient extends Context.Service<
  TrainerClient,
  {
    /** One tiny real call with the key, on the provider's light fallback model. */
    readonly testKey: (
      credentials: TrainerCredentials
    ) => Effect.Effect<KeyTestStatus>;
    /**
     * A Trainer on the key: the provider's primary model answers each call within the time
     * limit, and its fallback model takes over on overload only.
     */
    readonly trainerFor: (credentials: TrainerCredentials) => TrainerMethods;
  }
>()("server/TrainerClient") {
  /** The layer whose providers call `providerFetch`: tests answer for the providers with it. */
  static readonly layerWith = (providerFetch?: ProviderFetch) =>
    Layer.effect(
      TrainerClient,
      Effect.gen(function* () {
        const { models } = yield* TrainerConfig;

        return TrainerClient.of({
          // A key is valid or not whatever the model: the light fallback answers the test, so
          // that a slow primary model never makes a working key read as "busy".
          testKey: Effect.fn("TrainerClient.testKey")(function* (
            credentials: TrainerCredentials
          ) {
            const model = modelsOf(
              credentials,
              providerFetch
            )(models[credentials.provider].fallback);
            return yield* testKey(model).pipe(
              Effect.timeout(KEY_TEST_TIMEOUT),
              Effect.match({
                onFailure: (error): KeyTestStatus =>
                  error._tag === "TrainerKeyRejectedError" ? "invalid" : "busy",
                onSuccess: (): KeyTestStatus => "works",
              }),
              Effect.catchDefect(() => Effect.succeed<KeyTestStatus>("busy"))
            );
          }),
          trainerFor: (credentials) => {
            const languageModel = modelsOf(credentials, providerFetch);
            const { fallback, primary } = models[credentials.provider];
            return withResilience(
              createAiSdkTrainer(languageModel(primary)),
              createAiSdkTrainer(languageModel(fallback)),
              { timeout: TRAINER_TIMEOUT }
            );
          },
        });
      })
    ).pipe(Layer.provide(TrainerConfig.layer));

  static readonly layer = TrainerClient.layerWith();
}
