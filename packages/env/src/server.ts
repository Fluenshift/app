import { Config, Context, Effect, Layer, Option } from "effect";
import type { Redacted } from "effect";

/** `local` runs on the learner's machine; `hosted` is the public site (docs/adr/0003). */
export type DeployProfile = "local" | "hosted";

/** The Deploy Profile `DEPLOY_PROFILE` names, `local` when it names none. */
export const deployProfileConfig = Config.Literals(
  ["local", "hosted"],
  "DEPLOY_PROFILE"
).pipe(Config.withDefault("local" as const));

/** PGlite in a data directory locally; Postgres when hosted (docs/adr/0017). */
export type DatabaseConfig =
  | { readonly kind: "pglite"; readonly dataDirectory: string }
  | { readonly kind: "postgres"; readonly url: Redacted.Redacted<string> };

/** Input caps, enforced at the edge and in the services (docs/adr/0006). */
export interface InputLimits {
  readonly bodyMaxBytes: number;
  readonly codeMaxCharacters: Option.Option<number>;
  readonly sampleMaxBytes: number;
  readonly sampleMaxCharacters: Option.Option<number>;
}

const BODY_MAX_BYTES = 256 * 1024;
const SAMPLE_MAX_BYTES = 32 * 1024;

const LIMITS: Readonly<Record<DeployProfile, InputLimits>> = {
  hosted: {
    bodyMaxBytes: BODY_MAX_BYTES,
    codeMaxCharacters: Option.some(2000),
    sampleMaxBytes: SAMPLE_MAX_BYTES,
    sampleMaxCharacters: Option.some(5000),
  },
  local: {
    bodyMaxBytes: BODY_MAX_BYTES,
    codeMaxCharacters: Option.none(),
    sampleMaxBytes: SAMPLE_MAX_BYTES,
    sampleMaxCharacters: Option.none(),
  },
};

/** What `NODE_ENV` names: whether the server runs as production, development or a test. */
export const nodeEnvConfig = Config.Literals(
  ["development", "production", "test"],
  "NODE_ENV"
).pipe(Config.withDefault("development" as const));

const databaseConfig = (
  profile: DeployProfile
): Config.Config<DatabaseConfig> =>
  profile === "hosted"
    ? Config.Redacted("DATABASE_URL").pipe(
        Config.map((url): DatabaseConfig => ({ kind: "postgres", url }))
      )
    : Config.NonEmptyString("DATA_DIRECTORY").pipe(
        Config.map((dataDirectory): DatabaseConfig => ({
          dataDirectory,
          kind: "pglite",
        }))
      );

/**
 * Server configuration, read through Effect `Config` so that every value is validated once,
 * when the layer is built. The deploy profile decides where data lives and which caps apply.
 */
export class ServerConfig extends Context.Service<
  ServerConfig,
  {
    readonly database: DatabaseConfig;
    readonly dataDisplayPath: Option.Option<string>;
    readonly host: string;
    readonly limits: InputLimits;
    readonly migrationsPath: string;
    readonly nodeEnv: "development" | "production" | "test";
    readonly port: number;
    readonly profile: DeployProfile;
    readonly webDistPath: string;
  }
>()("@fluenshift/env/ServerConfig") {
  static readonly layer = Layer.effect(
    ServerConfig,
    Effect.gen(function* () {
      const profile = yield* deployProfileConfig;
      const [
        database,
        dataDisplayPath,
        host,
        migrationsPath,
        nodeEnv,
        port,
        webDistPath,
      ] = yield* Config.all([
        databaseConfig(profile),
        Config.option(Config.NonEmptyString("DATA_DISPLAY_PATH")),
        Config.NonEmptyString("SERVER_HOST").pipe(
          Config.withDefault("127.0.0.1")
        ),
        Config.NonEmptyString("MIGRATIONS_PATH").pipe(
          Config.withDefault("../../packages/db/src/migrations")
        ),
        nodeEnvConfig,
        Config.Port("SERVER_PORT").pipe(Config.withDefault(3000)),
        Config.NonEmptyString("WEB_DIST_PATH").pipe(
          Config.withDefault("../web/dist")
        ),
      ]);

      return ServerConfig.of({
        dataDisplayPath,
        database,
        host,
        limits: LIMITS[profile],
        migrationsPath,
        nodeEnv,
        port,
        profile,
        webDistPath,
      });
    })
  );
}
