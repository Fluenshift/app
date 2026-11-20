import path from "node:path";

import { NodeRuntime } from "@effect/platform-node";
import { CURRENT_RUBRIC_VERSION } from "@fluenshift/core/rubric-v1";
import { Database } from "@fluenshift/db";
import { ServerConfig, TrainerConfig } from "@fluenshift/env";
import { Effect, Layer, Option } from "effect";

import {
  explainAttemptFor,
  generateExercisesFor,
  startInterviewFor,
} from "./academy/academy-requests";
import { dailyChallenge } from "./academy/daily-challenge";
import { listPendingExercises } from "./academy/exercise-repository";
import { submitAttempt } from "./academy/exercise-service";
import { endInterview, getSession } from "./academy/interview-service";
import { TrainerClient } from "./academy/trainer/trainer-client";
import {
  createVocabularyItem,
  deleteVocabularyItem,
  listVocabularyItems,
} from "./academy/vocabulary-repository";
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
import { answerInterviewTurnFor } from "./practice/practice-writing";
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
      | Database
      | EvaluationModel
      | LearnerIdentity
      | ServerConfig
      | TrainerClient
      | TrainerConfig
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
      answerInterviewTurn: answerInterviewTurnFor,
      createVocabularyItem,
      deleteEvaluation,
      deleteVocabularyItem,
      endInterview,
      explainAttempt: explainAttemptFor,
      generateExercises: generateExercisesFor,
      getDailyChallenge: dailyChallenge,
      evaluateWriting: (writingSample) =>
        evaluateWritingForEndpoint(writingSample, new Date()),
      getEvaluation,
      getInterviewSession: getSession,
      getProgressEvidence,
      getProgressSummary,
      limits: config.limits,
      listEvaluations: () => listEvaluations(),
      listPendingExercises,
      listVocabularyItems,
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
      startInterview: startInterviewFor,
      submitAttempt,
      testTrainerKey: (credentials) =>
        TrainerClient.pipe(
          Effect.flatMap((client) => client.testKey(credentials))
        ),
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
      LearnerIdentity.local,
      TrainerClient.layer.pipe(Layer.provideMerge(TrainerConfig.layer))
    )
  ),
  Layer.provide(ServerConfig.layer)
);

NodeRuntime.runMain(Layer.launch(HttpServer));
