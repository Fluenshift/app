import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Exit, Layer, Option, Redacted } from "effect";

import { ServerConfig } from "./server";

const withEnv = (env: Record<string, string>) =>
  ServerConfig.layer.pipe(
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(env)))
  );

const failsWith = (env: Record<string, string>) =>
  Effect.gen(function* () {
    const outcome = yield* Effect.exit(
      Effect.provide(ServerConfig, withEnv(env))
    );

    assert.isTrue(Exit.isFailure(outcome));
  });

describe("ServerConfig", () => {
  it.effect("applies defaults when only DATA_DIRECTORY is set", () =>
    Effect.gen(function* () {
      const config = yield* ServerConfig;

      assert.strictEqual(config.profile, "local");
      assert.deepStrictEqual(config.database, {
        dataDirectory: "/data/pglite",
        kind: "pglite",
      });
      assert.isTrue(Option.isNone(config.dataDisplayPath));
      assert.strictEqual(config.host, "127.0.0.1");
      assert.strictEqual(
        config.migrationsPath,
        "../../packages/db/src/migrations"
      );
      assert.strictEqual(config.nodeEnv, "development");
      assert.strictEqual(config.port, 3000);
      assert.strictEqual(config.webDistPath, "../web/dist");
    }).pipe(Effect.provide(withEnv({ DATA_DIRECTORY: "/data/pglite" })))
  );

  it.effect("reads explicit values for the hosted profile", () =>
    Effect.gen(function* () {
      const config = yield* ServerConfig;

      assert.strictEqual(config.profile, "hosted");
      assert.strictEqual(config.database.kind, "postgres");
      assert.strictEqual(
        config.database.kind === "postgres"
          ? Redacted.value(config.database.url)
          : "",
        "postgres://app@db:5432/app"
      );
      assert.strictEqual(config.host, "0.0.0.0");
      assert.strictEqual(
        Option.getOrThrow(config.dataDisplayPath),
        "./retained/data"
      );
      assert.strictEqual(config.migrationsPath, "/srv/migrations");
      assert.strictEqual(config.nodeEnv, "production");
      assert.strictEqual(config.port, 8080);
      assert.strictEqual(config.webDistPath, "/srv/web");
    }).pipe(
      Effect.provide(
        withEnv({
          DATABASE_URL: "postgres://app@db:5432/app",
          DATA_DISPLAY_PATH: "./retained/data",
          DEPLOY_PROFILE: "hosted",
          MIGRATIONS_PATH: "/srv/migrations",
          NODE_ENV: "production",
          SERVER_HOST: "0.0.0.0",
          SERVER_PORT: "8080",
          WEB_DIST_PATH: "/srv/web",
        })
      )
    )
  );

  it.effect("fails when DATA_DIRECTORY is missing in the local profile", () =>
    failsWith({})
  );

  it.effect("fails when DATABASE_URL is missing in the hosted profile", () =>
    failsWith({ DATA_DIRECTORY: "/data/pglite", DEPLOY_PROFILE: "hosted" })
  );

  it.effect("rejects a NODE_ENV outside the allowed set", () =>
    failsWith({ DATA_DIRECTORY: "/data/pglite", NODE_ENV: "staging" })
  );

  it.effect("rejects a deploy profile outside local and hosted", () =>
    failsWith({ DATA_DIRECTORY: "/data/pglite", DEPLOY_PROFILE: "browser" })
  );

  it.effect("rejects a port outside the valid range", () =>
    failsWith({ DATA_DIRECTORY: "/data/pglite", SERVER_PORT: "70000" })
  );

  it.effect("caps input by deploy profile", () =>
    Effect.gen(function* () {
      const local = yield* Effect.provide(
        ServerConfig,
        withEnv({ DATA_DIRECTORY: "/data/pglite" })
      );
      const hosted = yield* Effect.provide(
        ServerConfig,
        withEnv({
          DATABASE_URL: "postgres://app@db:5432/app",
          DEPLOY_PROFILE: "hosted",
        })
      );

      assert.deepStrictEqual(local.limits, {
        bodyMaxBytes: 262_144,
        codeMaxCharacters: Option.none(),
        sampleMaxBytes: 32_768,
        sampleMaxCharacters: Option.none(),
      });
      assert.deepStrictEqual(hosted.limits, {
        bodyMaxBytes: 262_144,
        codeMaxCharacters: Option.some(2000),
        sampleMaxBytes: 32_768,
        sampleMaxCharacters: Option.some(5000),
      });
    })
  );
});
