import path from "node:path";

import { NodeRuntime } from "@effect/platform-node";
import { CURRENT_RUBRIC_VERSION } from "@fluenshift/core/rubric-v1";
import { Database } from "@fluenshift/db";
import { ServerConfig, SessionConfig, TrainerConfig } from "@fluenshift/env";
import { Effect, Layer, Option } from "effect";

import { academyDashboard } from "./academy/academy-dashboard";
import {
  explainAttemptFor,
  generateExercisesFor,
  startInterviewFor,
} from "./academy/academy-requests";
import { dailyChallenge } from "./academy/daily-challenge";
import { listPendingExercises } from "./academy/exercise-repository";
import { submitAttempt } from "./academy/exercise-service";
import { endInterview, getSession } from "./academy/interview-service";
import { mistakeNotebook } from "./academy/mistake-notebook";
import { TrainerClient } from "./academy/trainer/trainer-client";
import {
  createVocabularyItem,
  deleteVocabularyItem,
  listVocabularyItems,
} from "./academy/vocabulary-repository";
import { createApp, serveApp } from "./app";
import type { ProfileOptions } from "./app";
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
  answerInterviewTurnFor,
  practiceWritingFor,
} from "./practice/practice-writing";
import {
  getProgressEvidence,
  getProgressSummary,
} from "./progress/progress-insights";

// The HTTP server of one deploy profile: `profile` names it, with the hosted profile's session.
const httpServer = <R>(profile: Effect.Effect<ProfileOptions, never, R>) =>
  Layer.effectDiscard(
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
        ...(yield* profile),
        answerInterviewTurn: answerInterviewTurnFor,
        createVocabularyItem,
        deleteEvaluation,
        deleteVocabularyItem,
        endInterview,
        explainAttempt: explainAttemptFor,
        generateExercises: generateExercisesFor,
        getAcademyDashboard: academyDashboard,
        getDailyChallenge: dailyChallenge,
        getMistakeNotebook: mistakeNotebook,
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
        writePractice: practiceWritingFor,
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
      yield* Effect.logInfo(
        `Listening on http://${config.host}:${config.port}`
      );
    })
  );

// The local profile acts for its one implicit Learner. The hosted profile reads SessionConfig
// once, for the session gate and for the Learner each signed cookie names; it fails to start in
// production without a session secret (docs/adr/0032).
const HttpServer = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* ServerConfig;
    return config.profile === "hosted"
      ? httpServer(
          Effect.gen(function* () {
            const session = yield* SessionConfig;
            return { profile: "hosted" as const, session };
          })
        ).pipe(
          Layer.provide(LearnerIdentity.hosted),
          Layer.provide(SessionConfig.layer)
        )
      : httpServer(Effect.succeed({ profile: "local" as const })).pipe(
          Layer.provide(LearnerIdentity.local)
        );
  })
).pipe(
  Layer.provide(
    Layer.mergeAll(
      Database.layer,
      OpenRouterEvaluationModelLive,
      TrainerClient.layer.pipe(Layer.provideMerge(TrainerConfig.layer))
    )
  ),
  Layer.provide(ServerConfig.layer)
);

NodeRuntime.runMain(Layer.launch(HttpServer));
