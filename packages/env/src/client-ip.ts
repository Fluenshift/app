import { Context, Layer, Redacted, Schema } from "effect";

/** How the hosted profile finds a request's client IP, and hides it, for its rate limits. */
export interface ClientIpSettings {
  /** The request header whose first entry is the client IP: the trusted-proxy setting. */
  readonly header: string;
  /** Salts the hash of the client IP, which is all that is ever stored. */
  readonly salt: Redacted.Redacted<string>;
}

/** The hosted profile cannot start in production without a salt for client IPs. */
export class MissingIpHashSaltError extends Schema.TaggedError<
  MissingIpHashSaltError,
  { readonly brand: unique symbol }
>()("MissingIpHashSaltError", { message: Schema.String }) {}

/**
 * The client IP settings of the hosted profile (docs/adr/0033). `CLIENT_IP_HEADER` names the
 * header the deployment's proxy sets, `x-forwarded-for` as on Grifando's Vercel by default.
 * `IP_HASH_SALT` is required in production, where the layer fails and the server does not
 * start; elsewhere a missing salt falls back to Grifando's fixed development salt.
 */
export class ClientIpConfig extends Context.Service<
  ClientIpConfig,
  ClientIpSettings
>()("@fluenshift/env/ClientIpConfig") {
  // Stub: placeholders, whatever the environment says.
  static readonly layer = Layer.succeed(
    ClientIpConfig,
    ClientIpConfig.of({ header: "", salt: Redacted.make("") })
  );
}
