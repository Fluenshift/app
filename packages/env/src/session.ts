import {
  Config,
  Context,
  Effect,
  Layer,
  Option,
  Redacted,
  Schema,
} from "effect";

import { nodeEnvConfig } from "./server";

// Ported from getSessionSecret in Grifando src/server/session/sessionToken.ts (74dbb9f).
const DEVELOPMENT_SECRET = "dev-only-session-secret-do-not-use-in-production";

/** What the hosted profile signs and sets its session cookie with (docs/adr/0003). */
export interface SessionSettings {
  /** Signs every session id; changing it starts every browser over as a new Learner. */
  readonly secret: Redacted.Redacted<string>;
  /** Whether the session cookie is `Secure`: in production only, as Grifando set it. */
  readonly secureCookie: boolean;
}

/** The hosted profile cannot start in production without a session secret. */
export class MissingSessionSecretError extends Schema.TaggedError<
  MissingSessionSecretError,
  { readonly brand: unique symbol }
>()("MissingSessionSecretError", { message: Schema.String }) {}

/**
 * The session settings of the hosted profile, which only that profile reads. `SESSION_SECRET`
 * is required in production, where the layer fails and the server does not start; elsewhere a
 * missing secret falls back to a fixed development secret, with a warning (docs/adr/0032).
 */
export class SessionConfig extends Context.Service<
  SessionConfig,
  SessionSettings
>()("@fluenshift/env/SessionConfig") {
  static readonly layer = Layer.effect(
    SessionConfig,
    Effect.gen(function* () {
      const [secret, environment] = yield* Config.all([
        Config.option(Config.Redacted("SESSION_SECRET")),
        nodeEnvConfig,
      ]);
      const production = environment === "production";
      if (Option.isSome(secret)) {
        return SessionConfig.of({
          secret: secret.value,
          secureCookie: production,
        });
      }
      if (production) {
        return yield* new MissingSessionSecretError({
          message: "SESSION_SECRET is not set — it is required in production.",
        });
      }
      yield* Effect.logWarning(
        "SESSION_SECRET is not set — using an insecure development secret."
      );
      return SessionConfig.of({
        secret: Redacted.make(DEVELOPMENT_SECRET),
        secureCookie: false,
      });
    })
  );
}
