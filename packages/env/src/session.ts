import { Context, Layer, Redacted, Schema } from "effect";

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
  // Stub: a placeholder secret, whatever the environment says.
  static readonly layer = Layer.succeed(
    SessionConfig,
    SessionConfig.of({ secret: Redacted.make(""), secureCookie: false })
  );
}
