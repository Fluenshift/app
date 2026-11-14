import { NodeRuntime } from "@effect/platform-node";
import { Database } from "@fluenshift/db";
import { ServerConfig } from "@fluenshift/env";
import { serve } from "@hono/node-server";
import { Effect, Layer } from "effect";

import { createApp } from "./app";

const HttpServer = Layer.effectDiscard(
  Effect.gen(function* () {
    const { host, limits, nodeEnv, port, profile, webDistPath } =
      yield* ServerConfig;
    // The database opens before the server listens, so a data directory that cannot be
    // written or a Postgres server that cannot be reached stops the process at startup.
    yield* Database;
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
).pipe(Layer.provide(Database.layer), Layer.provide(ServerConfig.layer));

NodeRuntime.runMain(Layer.launch(HttpServer));
