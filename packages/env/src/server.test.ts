import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Exit, Layer } from "effect";

import { ServerConfig } from "./server";

const withEnv = (env: Record<string, string>) =>
  ServerConfig.layer.pipe(
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(env)))
  );

describe("ServerConfig", () => {
  it.effect("binds to loopback on port 3000 by default", () =>
    Effect.gen(function* () {
      const config = yield* ServerConfig;
      assert.strictEqual(config.host, "127.0.0.1");
      assert.strictEqual(config.port, 3000);
    }).pipe(Effect.provide(withEnv({})))
  );

  it.effect("reads explicit values", () =>
    Effect.gen(function* () {
      const config = yield* ServerConfig;
      assert.strictEqual(config.host, "0.0.0.0");
      assert.strictEqual(config.port, 8080);
    }).pipe(
      Effect.provide(withEnv({ SERVER_HOST: "0.0.0.0", SERVER_PORT: "8080" }))
    )
  );

  it.effect("rejects a port outside the valid range", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        Effect.provide(ServerConfig, withEnv({ SERVER_PORT: "70000" }))
      );
      assert.isTrue(Exit.isFailure(exit));
    })
  );
});
