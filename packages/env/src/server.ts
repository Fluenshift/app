import { Config, Context, Effect, Layer } from "effect";

/**
 * Server configuration, read once through Effect `Config` when the layer is built. The
 * deploy-profile settings join it in Phase 2 step 3 (docs/adr/0003).
 */
export class ServerConfig extends Context.Service<
  ServerConfig,
  {
    readonly host: string;
    readonly port: number;
  }
>()("@fluenshift/env/ServerConfig") {
  static readonly layer = Layer.effect(
    ServerConfig,
    Effect.gen(function* () {
      const [host, port] = yield* Config.all([
        Config.NonEmptyString("SERVER_HOST").pipe(
          Config.withDefault("127.0.0.1")
        ),
        Config.Port("SERVER_PORT").pipe(Config.withDefault(3000)),
      ]);
      return ServerConfig.of({ host, port });
    })
  );
}
