// Which model answers the Trainer's calls, and the key test (docs/adr/0012).
import { TrainerConfig } from "@fluenshift/env";
import type { TrainerProvider } from "@fluenshift/env";
import { Context, Effect, Layer } from "effect";
import type { Redacted } from "effect";

import type { TrainerMethods } from "./trainer-model";

/** One Learner's key for one provider. */
export interface TrainerCredentials {
  readonly apiKey: Redacted.Redacted<string>;
  readonly provider: TrainerProvider;
}

export type KeyTestStatus = "busy" | "invalid" | "works";

const unbuilt: TrainerMethods = {
  continueInterview: () => Effect.succeed({ model: "", question: "" }),
  explainAttempt: () => Effect.succeed({ explanation: "", model: "" }),
  generateExercises: () => Effect.succeed({ exercises: [], model: "" }),
};

export class TrainerClient extends Context.Service<
  TrainerClient,
  {
    readonly testKey: (
      credentials: TrainerCredentials
    ) => Effect.Effect<KeyTestStatus>;
    readonly trainerFor: (credentials: TrainerCredentials) => TrainerMethods;
  }
>()("server/TrainerClient") {
  static readonly layerWith = (_providerFetch?: typeof globalThis.fetch) =>
    Layer.succeed(
      TrainerClient,
      TrainerClient.of({
        testKey: () => Effect.succeed("works"),
        trainerFor: () => unbuilt,
      })
    ).pipe(Layer.provide(TrainerConfig.layer));

  static readonly layer = TrainerClient.layerWith();
}
