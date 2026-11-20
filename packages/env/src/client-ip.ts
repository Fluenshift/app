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

// Ported from getIpHashSalt in Grifando src/server/clientIp.ts (74dbb9f).
const DEVELOPMENT_SALT = "dev-only-ip-hash-salt-do-not-use-in-production";

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
  static readonly layer = Layer.effect(
    ClientIpConfig,
    Effect.gen(function* () {
      const [salt, header, environment] = yield* Config.all([
        Config.option(Config.Redacted("IP_HASH_SALT")),
        Config.NonEmptyString("CLIENT_IP_HEADER").pipe(
          Config.withDefault("x-forwarded-for")
        ),
        nodeEnvConfig,
      ]);
      if (Option.isSome(salt)) {
        return ClientIpConfig.of({ header, salt: salt.value });
      }
      if (environment === "production") {
        return yield* new MissingIpHashSaltError({
          message: "IP_HASH_SALT is not set — it is required in production.",
        });
      }
      return ClientIpConfig.of({
        header,
        salt: Redacted.make(DEVELOPMENT_SALT),
      });
    })
  );
}
