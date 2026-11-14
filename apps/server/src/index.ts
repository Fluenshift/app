import { NodeRuntime } from "@effect/platform-node";
import { ServerConfig } from "@fluenshift/env";
import { serve } from "@hono/node-server";
import { Effect, Layer } from "effect";

import { createApp } from "./app";

const HttpServer = Layer.effectDiscard(
  Effect.gen(function* () {
    const { host, limits, nodeEnv, port, profile, webDistPath } =
      yield* ServerConfig;
    const app = createApp({
      limits,
      profile,
      serveWeb: nodeEnv === "production",
      webDistPath,
    });
    yield* Effect.acquireRelease(
      Effect.sync(() => serve({ fetch: app.fetch, hostname: host, port })),
      (server) =>
        Effect.callback((resume) => {
          server.close(() => {
            resume(Effect.void);
          });
        })
    );
    yield* Effect.logInfo(`Listening on http://${host}:${port}`);
  })
).pipe(Layer.provide(ServerConfig.layer));

NodeRuntime.runMain(Layer.launch(HttpServer));
