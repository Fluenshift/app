import path from "node:path";

import { NodeRuntime } from "@effect/platform-node";
import { CURRENT_RUBRIC_VERSION } from "@fluenshift/core/rubric-v1";
import { Database } from "@fluenshift/db";
import { ServerConfig } from "@fluenshift/env";
import { Effect, Layer, Option } from "effect";

import { createApp, serveApp } from "./app";
import { evaluateWritingForEndpoint } from "./evaluation/evaluation-endpoint";
import { EvaluationModel } from "./evaluation/evaluation-model";
import { OpenRouterEvaluationModelLive } from "./evaluation/openrouter-evaluation-model";
import {
  deleteEvaluation,
  getEvaluation,
  listEvaluations,
} from "./history/learning-history";
import { LearnerIdentity } from "./learner-identity";
import {
  getProgressEvidence,
  getProgressSummary,
} from "./progress/progress-insights";

const HttpServer = Layer.effectDiscard(
  Effect.gen(function* () {
    const config = yield* ServerConfig;
    // The database opens before the server listens, so a data directory that cannot be
    // written or a Postgres server that cannot be reached stops the process at startup.
    yield* Database;
    const model = yield* EvaluationModel;
    const services = yield* Effect.context<
      Database | EvaluationModel | LearnerIdentity | ServerConfig
    >();
    // Where the setup status says the data lives; a Postgres URL is never shown.
    const storedAt =
      config.database.kind === "pglite"
        ? path.resolve(config.database.dataDirectory)
        : "PostgreSQL";
    const dataLocation = Option.getOrElse(
      config.dataDisplayPath,
      () => storedAt
    );
    const app = createApp({
      deleteEvaluation,
      evaluateWriting: (writingSample) =>
        evaluateWritingForEndpoint(writingSample, new Date()),
      getEvaluation,
      getProgressEvidence,
      getProgressSummary,
      limits: config.limits,
      listEvaluations: () => listEvaluations(),
      // The event carries codes, timings and the model, never the Writing Sample.
      logEvaluation: (event) => {
        Effect.runSyncWith(services)(
          Effect.logInfo("writing-evaluation").pipe(
            Effect.annotateLogs({ ...event })
          )
        );
      },
      profile: config.profile,
      runtime: { runPromiseExit: Effect.runPromiseExitWith(services) },
      serveWeb: config.nodeEnv === "production",
      setup: {
        configured: model.configured,
        dataLocation,
        model: model.model,
        provider: model.provider,
        rubricVersion: CURRENT_RUBRIC_VERSION,
      },
      webDistPath: config.webDistPath,
    });
    yield* Effect.acquireRelease(
      Effect.sync(() =>
        serveApp(app, { hostname: config.host, port: config.port })
      ),
      (server) =>
        Effect.callback((resume) => {
          server.close(() => {
            resume(Effect.void);
          });
        })
    );
    yield* Effect.logInfo(`Listening on http://${config.host}:${config.port}`);
  })
).pipe(
  Layer.provide(
    Layer.mergeAll(
      Database.layer,
      OpenRouterEvaluationModelLive,
      LearnerIdentity.local
    )
  ),
  Layer.provide(ServerConfig.layer)
);

NodeRuntime.runMain(Layer.launch(HttpServer));
