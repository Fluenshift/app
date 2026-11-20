import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

import {
  AttemptRequest,
  ErrorCategory,
  ExerciseGenerationRequest,
  InterviewAnswerRequest,
  ProgressEvidenceRequest,
  ProgressPeriod,
  VocabularyItemRequest,
} from "@fluenshift/contract";
import type {
  DailyChallenge,
  HealthResponse,
  ProgressEvidenceSelection,
  SetupStatus,
  GeneratedExercise,
  AIResponseValidationError,
} from "@fluenshift/contract";
import {
  EVALUATION_HTTP_IDLE_TIMEOUT_SECONDS,
  EVALUATION_MAX_OUTPUT_TOKENS,
  EVALUATION_REQUEST_TIMEOUT_MILLISECONDS,
} from "@fluenshift/core/evaluation-request-policy";
import { toPublicExercise } from "@fluenshift/core/public-view";
import type { DatabaseError } from "@fluenshift/db";
import type { DeployProfile, InputLimits } from "@fluenshift/env";
import { getRequestListener } from "@hono/node-server";
import { Effect, Option, Schema } from "effect";
import { Hono } from "hono";
import type { Context as HonoContext, Handler, MiddlewareHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { getMimeType } from "hono/utils/mime";

import type { NotFoundError } from "./academy/errors";
import type { SubmitAttemptResult } from "./academy/exercise-service";
import type {
  AnswerTurnInput,
  AnswerTurnResult,
  InterviewSession,
  InterviewTurn,
  NextTurn,
} from "./academy/interview-service";
import {
  readTrainerCredentials,
  TRAINER_FAILURES,
  trainerFailure,
} from "./academy/trainer/credentials";
import type {
  KeyTestStatus,
  TrainerCredentials,
} from "./academy/trainer/trainer-client";
import { TrainerKeyRequiredError } from "./academy/trainer/trainer-errors";
import type { TrainerAccessError } from "./academy/trainer/trainer-errors";
import { INTERNAL_ERROR, makeEdge } from "./edge";
import type { EdgeFailure, EdgeRuntime } from "./edge";
import { endpointFailure } from "./evaluation/evaluation-endpoint";
import type {
  EvaluationEndpointResult,
  EvaluationFailureCode,
  WritingEvaluationFailure,
} from "./evaluation/evaluation-endpoint";
import type { Evaluation } from "./history/learning-history";
import { CurrentLearner, LearnerIdentity } from "./learner-identity";
import type { EnrichmentFailedError } from "./practice/practice-writing";

export interface EvaluationLogEvent {
  readonly code:
    | EvaluationFailureCode
    | "created"
    | "internal-error"
    | "no-english";
  readonly correlationId: string;
  readonly durationMilliseconds: number;
  readonly maxOutputTokens: number;
  readonly model: string;
  readonly provider: string;
  readonly requestTimeoutMilliseconds: number;
}

/**
 * What the routes need from the rest of the server, as PE's `createApp` took it. Each boundary is
 * an Effect that runs for the Learner of the request; a route whose boundary is missing answers
 * 503, as PE's did.
 */
export interface AppBoundaries<R = never> {
  /** One answer to the Learner's interview turn, evaluated as practice writing on the request's key. */
  readonly answerInterviewTurn?: (
    headers: Headers,
    input: AnswerTurnInput
  ) => Effect.Effect<
    AnswerTurnResult<Evaluation>,
    | AIResponseValidationError
    | DatabaseError
    | EnrichmentFailedError
    | NotFoundError
    | TrainerAccessError
    | WritingEvaluationFailure,
    R | CurrentLearner
  >;
  /** Today's Practice Prompt from the daily bank, biased toward the Learner's weak categories. */
  readonly getDailyChallenge?: () => Effect.Effect<
    DailyChallenge,
    DatabaseError,
    R | CurrentLearner
  >;
  readonly deleteEvaluation?: (
    evaluationId: string
  ) => Effect.Effect<void, DatabaseError, R | CurrentLearner>;
  readonly evaluateWriting?: (
    writingSample: string
  ) => Effect.Effect<EvaluationEndpointResult, never, R | CurrentLearner>;
  readonly getEvaluation?: (
    evaluationId: string
  ) => Effect.Effect<unknown, DatabaseError, R | CurrentLearner>;
  readonly getProgressEvidence?: (request: {
    readonly period: ProgressPeriod;
    readonly selection: ProgressEvidenceSelection;
  }) => Effect.Effect<unknown, DatabaseError, R | CurrentLearner>;
  readonly getProgressSummary?: (request: {
    readonly period: ProgressPeriod;
  }) => Effect.Effect<unknown, DatabaseError, R | CurrentLearner>;
  readonly listEvaluations?: () => Effect.Effect<
    readonly unknown[],
    DatabaseError,
    R | CurrentLearner
  >;
  readonly logEvaluation?: (event: EvaluationLogEvent) => void;
  readonly setup?: SetupStatus;
  readonly createVocabularyItem?: (
    request: VocabularyItemRequest
  ) => Effect.Effect<unknown, DatabaseError, R | CurrentLearner>;
  /** The Learner's vocabulary items, newest first. */
  readonly listVocabularyItems?: () => Effect.Effect<
    readonly unknown[],
    DatabaseError,
    R | CurrentLearner
  >;
  /** Whether the Learner had an item with that id, which is now deleted. */
  readonly deleteVocabularyItem?: (
    id: string
  ) => Effect.Effect<boolean, DatabaseError, R | CurrentLearner>;
  /** Ends the Learner's interview session; false when the Learner has no such session. */
  readonly endInterview?: (
    sessionId: string
  ) => Effect.Effect<boolean, DatabaseError, R | CurrentLearner>;
  /** An explanation of one graded Attempt on the key the request carries, or null for none. */
  readonly explainAttempt?: (
    headers: Headers,
    input: { readonly attemptId: string; readonly exerciseId: string }
  ) => Effect.Effect<
    string | null,
    AIResponseValidationError | DatabaseError | TrainerAccessError,
    R | CurrentLearner
  >;
  /** A practice set from the Learner's patterns, generated on the key the request carries. */
  readonly generateExercises?: (
    headers: Headers,
    request: ExerciseGenerationRequest
  ) => Effect.Effect<
    readonly PendingExercise[],
    AIResponseValidationError | DatabaseError | TrainerAccessError,
    R | CurrentLearner
  >;
  /** The Learner's interview session with its turns in order, or null for none. */
  readonly getInterviewSession?: (
    sessionId: string
  ) => Effect.Effect<
    InterviewSession | null,
    DatabaseError,
    R | CurrentLearner
  >;
  /** The Learner's Exercises without an Attempt, oldest first. */
  readonly listPendingExercises?: () => Effect.Effect<
    readonly PendingExercise[],
    DatabaseError,
    R | CurrentLearner
  >;
  /** A new interview session and its opening question, asked on the key the request carries. */
  readonly startInterview?: (
    headers: Headers
  ) => Effect.Effect<
    StartedInterview,
    AIResponseValidationError | DatabaseError | TrainerAccessError,
    R | CurrentLearner
  >;
  /** Grades one answer to the Learner's Exercise; no Trainer takes part. */
  readonly submitAttempt?: (
    exerciseId: string,
    answer: string
  ) => Effect.Effect<
    SubmitAttemptResult,
    DatabaseError | NotFoundError,
    R | CurrentLearner
  >;
  /** One tiny call with the Learner's key (TrainerClient.testKey). */
  readonly testTrainerKey?: (
    credentials: TrainerCredentials
  ) => Effect.Effect<KeyTestStatus, never, R>;
}

/** A new interview session and the turn that asks its opening question. */
export interface StartedInterview {
  readonly sessionId: string;
  readonly turn: NextTurn;
}

/** What a route needs of an Exercise to show it. */
export interface PendingExercise {
  readonly id: string;
  readonly promptData: GeneratedExercise;
  readonly type: string;
}

export interface AppOptions<R = never> extends AppBoundaries<R> {
  /** The input caps of the deploy profile (docs/adr/0006). */
  readonly limits: InputLimits;
  readonly profile: DeployProfile;
  /** Runs the boundaries; it provides what they need besides the Learner of the request. */
  readonly runtime: EdgeRuntime<R | LearnerIdentity>;
  /** Whether this process also serves the web build, as it does in production. */
  readonly serveWeb: boolean;
  readonly webDistPath: string;
}

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

const FORBIDDEN: EdgeFailure = {
  body: {
    code: "forbidden",
    error: "Only same-origin localhost access is allowed",
  },
  status: 403,
};

const SAMPLE_TOO_LARGE: EdgeFailure = {
  body: { code: "sample-too-large", error: "Writing Sample is too large" },
  status: 413,
};

/**
 * The local profile has no authentication, so it answers only same-origin requests to a
 * loopback host name: binding to loopback alone does not stop a hostile web page from driving
 * the application (docs/adr/0003).
 */
const isForeign = (request: Request): boolean => {
  const url = new URL(request.url);
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");
  return (
    !LOOPBACK_HOSTNAMES.has(url.hostname) ||
    (host !== null && host !== url.host) ||
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (origin !== null && origin !== url.origin)
  );
};

const refusalOf = (
  request: Request,
  { limits, profile }: Pick<AppOptions, "limits" | "profile">
): EdgeFailure | undefined => {
  if (profile === "local" && isForeign(request)) {
    return FORBIDDEN;
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  return contentLength > limits.bodyMaxBytes ? SAMPLE_TOO_LARGE : undefined;
};

/**
 * Runs before every route: it refuses a foreign request and a declared body over the cap, and
 * marks every API answer as not storable. An accepted request gets the header once its answer
 * exists, because a route may answer with a `Response` of its own, as the edge helper does.
 */
const guard =
  (options: Pick<AppOptions, "limits" | "profile">): MiddlewareHandler =>
  (context, next) => {
    const markApi = () => {
      if (context.req.path.startsWith("/api/")) {
        context.header("cache-control", "no-store");
      }
    };
    const refusal = refusalOf(context.req.raw, options);
    if (refusal !== undefined) {
      markApi();
      return Promise.resolve(context.json(refusal.body, refusal.status));
    }
    return next().then(markApi);
  };

/**
 * Answers every GET that no API route took. Only files under `assets/` of the web build are
 * served, and the path is never decoded, so no request reaches a file outside that directory.
 * Any other path is a browser route and gets the application shell.
 */
const webFallback = (webDistPath: string): Handler => {
  const root = path.resolve(webDistPath);
  const index = path.resolve(root, "index.html");

  return (context) => {
    if (context.req.path.startsWith("/api/")) {
      return context.json({ error: "Not Found" }, 404);
    }

    const requestPath = new URL(context.req.url).pathname;
    if (!requestPath.startsWith("/assets/")) {
      return readFile(index, "utf-8").then((html) =>
        context.html(html, 200, { "cache-control": "no-cache" })
      );
    }

    const assetPath = path.resolve(root, `.${requestPath}`);
    if (!assetPath.startsWith(`${root}${path.sep}`)) {
      return context.text("Not Found", 404);
    }
    return readFile(assetPath).then(
      (asset) =>
        context.body(asset, 200, {
          "cache-control": "public, max-age=31536000, immutable",
          "content-type": getMimeType(assetPath) ?? "application/octet-stream",
        }),
      () => context.text("Not Found", 404)
    );
  };
};

const INVALID_REQUEST = {
  code: "invalid-request",
  error: "Request could not be completed",
};

const notReady = (error: string) => ({ code: "not-ready", error });

const PROGRESS_NOT_READY = notReady("Progress is not available");
const INTERVIEWS_NOT_READY = notReady("Interviews are not available");
const PRACTICE_PROMPTS_NOT_READY = notReady(
  "Practice prompts are not available"
);

const INVALID_PERIOD = {
  code: "invalid-period",
  error: "Progress period is invalid",
};

const INVALID_SELECTION = {
  code: "invalid-selection",
  error: "Progress selection is invalid",
};

// Grifando's vocabulary routes answer every issue of a refused body (src/app/api/vocabulary,
// 74dbb9f), and a failure with a message the Learner can act on.
const VOCABULARY_REQUEST = Schema.toStandardSchemaV1(VocabularyItemRequest, {
  parseOptions: { errors: "all" },
});
const SOMETHING_WENT_WRONG: EdgeFailure = {
  body: { error: "Something went wrong. Please try again." },
  status: 500,
};

// Grifando's POST /api/exercises takes an optional body; one that is not JSON counts as absent.
const EXERCISE_REQUEST = Schema.toStandardSchemaV1(ExerciseGenerationRequest, {
  parseOptions: { errors: "all" },
});
const NO_PATTERNS = {
  error:
    "No mistake patterns yet \u2014 write something first to get personalized exercises.",
};

// Grifando's attempt route refuses a body without a valid answer before it reads the Exercise;
// a body that is not JSON is refused too.
const ATTEMPT_REQUEST = Schema.toStandardSchemaV1(AttemptRequest, {
  parseOptions: { errors: "all" },
});
// Another Learner's record reads as one that does not exist.
const NOT_FOUND: EdgeFailure = { body: { error: "Not found" }, status: 404 };
// Grifando's answer when an explanation fails: 500, or 502 for an answer the Trainer's schema
// refuses. The grade stays as it was.
const EXPLANATION_FAILED: EdgeFailure = {
  body: {
    error:
      "We couldn't explain this answer right now. Your grade is unaffected \u2014 try again.",
  },
  status: 500,
};

// What the browser may see of an Exercise before its Attempt: never the answer or the
// explanation.
const publicView = ({ id, promptData, type }: PendingExercise) => ({
  id,
  prompt: toPublicExercise(promptData),
  type,
});

// What the browser sees of a turn that asks a question.
const nextTurnView = ({ id, order, question }: NextTurn) => ({
  id,
  order,
  question,
});

// What the browser sees of an interview turn: its answer and Evaluation, both null until it is
// answered, instead of Grifando's writing analysis (docs/adr/0010).
const interviewTurnView = ({
  answer,
  evaluationId,
  id,
  order,
  question,
}: InterviewTurn) => ({
  answer,
  evaluationId,
  id,
  order,
  question,
});

const decodePeriod = Schema.decodeUnknownOption(ProgressPeriod);
const decodeCategory = Schema.decodeUnknownOption(ErrorCategory);
const decodeEvidenceRequest = Schema.decodeUnknownOption(
  ProgressEvidenceRequest
);

/**
 * The selection a query string may carry: an insight or an Error Category, never a Correction,
 * whose text the Learner wrote and which travels in a request body instead (docs/adr/0008).
 */
const selectionInQuery = (
  insight: string | undefined,
  category: string | undefined
): Option.Option<ProgressEvidenceSelection> => {
  if (insight === "finding-rate" || insight === "average-score") {
    return Option.some({ kind: insight });
  }
  if (insight === "category") {
    return decodeCategory(category).pipe(
      Option.map((value) => ({ category: value, kind: "category" as const }))
    );
  }
  return Option.none();
};

const FAILURE_STATUS = {
  "configuration-missing": 503,
  "invalid-assessment": 502,
  "invalid-writing-sample": 400,
  "persistence-failure": 500,
  "provider-credits-exhausted": 503,
  "provider-output-incomplete": 502,
  "provider-rate-limited": 429,
  "provider-rejected": 502,
  "provider-timeout": 504,
  "provider-unavailable": 503,
} as const satisfies Record<EvaluationFailureCode, ContentfulStatusCode>;

const resultCode = (
  result: EvaluationEndpointResult
): EvaluationLogEvent["code"] =>
  result.kind === "failure" ? result.code : result.kind;

const resultStatus = (
  result: EvaluationEndpointResult
): ContentfulStatusCode => {
  if (result.kind === "created") {
    return 201;
  }
  return result.kind === "no-english" ? 422 : FAILURE_STATUS[result.code];
};

// What the Evaluation route answers when the Judge could not evaluate a Writing Sample.
const judgeFailure = (failure: WritingEvaluationFailure): EdgeFailure => {
  const result = endpointFailure(failure);
  return { body: result, status: resultStatus(result) };
};

// The body of an interview answer; one that is not JSON is refused like an empty answer.
const INTERVIEW_ANSWER_REQUEST = Schema.toStandardSchemaV1(
  InterviewAnswerRequest,
  { parseOptions: { errors: "all" } }
);
// Grifando's answer when the analysis of a writing fails for a reason the Learner cannot act on
// (src/server/domain/writing/writingCoachService.ts, 74dbb9f).
const ANALYSIS_FAILURE_MESSAGE =
  "We couldn't analyze this writing right now. Your text has not been lost \u2014 you can try again.";

const safelyLogEvaluation = (
  logEvaluation: AppBoundaries["logEvaluation"],
  event: EvaluationLogEvent
) => {
  try {
    logEvaluation?.(event);
  } catch {
    // Observability must never change the Evaluation outcome.
  }
};

const WritingSampleRequest = Schema.Struct({ writingSample: Schema.String });

/** The idle time a connection keeps while the Judge answers, beyond its own deadline. */
export const HTTP_IDLE_TIMEOUT_MILLISECONDS =
  EVALUATION_HTTP_IDLE_TIMEOUT_SECONDS * 1000;

/**
 * The HTTP application: the API and, in production, the web build, from one process. Routes
 * answer from Effects through the edge helper (`./edge`).
 */
export const createApp = <R = never>(options: AppOptions<R>) => {
  const edge = makeEdge(options.runtime);
  // Every boundary acts for the Learner that LearnerIdentity names for the request.
  const forLearner = <A, E>(
    request: Request,
    effect: Effect.Effect<A, E, R | CurrentLearner>
  ) =>
    effect.pipe(
      Effect.provideServiceEffect(
        CurrentLearner,
        Effect.gen(function* () {
          const identity = yield* LearnerIdentity;
          const id = yield* identity.identify(request);
          return CurrentLearner.of({ id });
        })
      )
    );
  const failedHistory = { DatabaseError: () => INTERNAL_ERROR };

  // Both evidence routes answer here once they have read a selection, or failed to.
  const evidence = (
    context: HonoContext,
    getProgressEvidence: NonNullable<AppBoundaries<R>["getProgressEvidence"]>,
    request: Option.Option<ProgressEvidenceRequest>
  ): Response | Promise<Response> =>
    Option.isNone(request)
      ? context.json(INVALID_SELECTION, 400)
      : edge(forLearner(context.req.raw, getProgressEvidence(request.value)), {
          errors: failedHistory,
          success: (found) => Response.json(found),
        });

  // PE's route checked the body before its handler ran, so a malformed request is a 400 even
  // when Evaluation is not configured; every answer of the handler names its correlation ID.
  const evaluate = (
    context: HonoContext,
    writingSample: string
  ): Response | Promise<Response> => {
    const correlationId = randomUUID();
    const startedAt = performance.now();
    const withCorrelation = (response: Response) => {
      response.headers.set("x-correlation-id", correlationId);
      return response;
    };
    const { evaluateWriting } = options;
    if (evaluateWriting === undefined) {
      return withCorrelation(
        context.json({ error: "Evaluation is not configured" }, 503)
      );
    }
    const log = (code: EvaluationLogEvent["code"]) => {
      safelyLogEvaluation(options.logEvaluation, {
        code,
        correlationId,
        durationMilliseconds: Math.round(performance.now() - startedAt),
        maxOutputTokens: EVALUATION_MAX_OUTPUT_TOKENS,
        model: options.setup?.model ?? "unconfigured",
        provider: options.setup?.provider ?? "unconfigured",
        requestTimeoutMilliseconds: EVALUATION_REQUEST_TIMEOUT_MILLISECONDS,
      });
    };
    return edge(
      forLearner(context.req.raw, evaluateWriting(writingSample)).pipe(
        Effect.tapDefect(() =>
          Effect.sync(() => {
            log("internal-error");
          })
        )
      ),
      {
        errors: {},
        success: (result) => {
          log(resultCode(result));
          return context.json(result, resultStatus(result));
        },
      }
    ).then(withCorrelation);
  };

  const app = new Hono()
    .use(guard(options))
    .get("/api/health", (context) =>
      context.json({ status: "ok" } satisfies HealthResponse)
    )
    .post("/api/evaluations", (context): Promise<Response> =>
      context.req.json<unknown>().then(
        (body) => {
          const request =
            Schema.decodeUnknownOption(WritingSampleRequest)(body);
          return Option.isNone(request)
            ? context.json(INVALID_REQUEST, 400)
            : evaluate(context, request.value.writingSample);
        },
        () => context.json(INVALID_REQUEST, 400)
      )
    )
    .get("/api/evaluations", (context): Response | Promise<Response> => {
      const { listEvaluations } = options;
      if (listEvaluations === undefined) {
        return context.json(notReady("History is not available"), 503);
      }
      return edge(forLearner(context.req.raw, listEvaluations()), {
        errors: failedHistory,
        success: (evaluations) => Response.json(evaluations),
      });
    })
    .get(
      "/api/evaluations/:evaluationId",
      (context): Response | Promise<Response> => {
        const { getEvaluation } = options;
        if (getEvaluation === undefined) {
          return context.json(notReady("History is not available"), 503);
        }
        return edge(
          forLearner(
            context.req.raw,
            getEvaluation(context.req.param("evaluationId"))
          ),
          {
            errors: failedHistory,
            success: (evaluation) =>
              evaluation === null
                ? context.json(
                    { code: "not-found", error: "Evaluation not found" },
                    404
                  )
                : Response.json(evaluation),
          }
        );
      }
    )
    .delete(
      "/api/evaluations/:evaluationId",
      (context): Response | Promise<Response> => {
        const { deleteEvaluation } = options;
        if (deleteEvaluation === undefined) {
          return context.json(notReady("History is not available"), 503);
        }
        return edge(
          forLearner(
            context.req.raw,
            deleteEvaluation(context.req.param("evaluationId"))
          ),
          {
            errors: failedHistory,
            success: () => context.body(null, 204),
          }
        );
      }
    )
    .get("/api/progress", (context): Response | Promise<Response> => {
      const { getProgressSummary } = options;
      if (getProgressSummary === undefined) {
        return context.json(PROGRESS_NOT_READY, 503);
      }
      const period = decodePeriod(context.req.query("period"));
      if (Option.isNone(period)) {
        return context.json(INVALID_PERIOD, 400);
      }
      return edge(
        forLearner(
          context.req.raw,
          getProgressSummary({ period: period.value })
        ),
        {
          errors: failedHistory,
          success: (summary) => Response.json(summary),
        }
      );
    })
    .get("/api/progress/evidence", (context): Response | Promise<Response> => {
      const { getProgressEvidence } = options;
      if (getProgressEvidence === undefined) {
        return context.json(PROGRESS_NOT_READY, 503);
      }
      const period = decodePeriod(context.req.query("period"));
      const selection = selectionInQuery(
        context.req.query("insight"),
        context.req.query("category")
      );
      return evidence(
        context,
        getProgressEvidence,
        Option.isSome(period) && Option.isSome(selection)
          ? Option.some({ period: period.value, selection: selection.value })
          : Option.none()
      );
    })
    .post("/api/progress/evidence", (context): Response | Promise<Response> => {
      const { getProgressEvidence } = options;
      if (getProgressEvidence === undefined) {
        return context.json(PROGRESS_NOT_READY, 503);
      }
      return context.req.json<unknown>().then(
        (body) =>
          evidence(context, getProgressEvidence, decodeEvidenceRequest(body)),
        () => context.json(INVALID_SELECTION, 400)
      );
    })
    // Tests the key the Learner's browser sends, read from the request headers only: the local
    // profile's configured key is never tested. A malformed key reads as invalid at once.
    .post("/api/ai-key/test", (context): Response | Promise<Response> => {
      const { testTrainerKey } = options;
      if (testTrainerKey === undefined) {
        return context.json(notReady("Key tests are not available"), 503);
      }
      return edge(
        readTrainerCredentials(context.req.raw.headers).pipe(
          Effect.matchEffect({
            onFailure: () => Effect.succeed<KeyTestStatus>("invalid"),
            onSuccess: (credentials) =>
              credentials === null
                ? Effect.fail(new TrainerKeyRequiredError())
                : testTrainerKey(credentials),
          })
        ),
        {
          errors: { TrainerKeyRequiredError: trainerFailure },
          success: (status) => Response.json({ status }),
        }
      );
    })
    // The Learner's pending Exercises, each by its public view: the answer and the explanation
    // never reach the browser before an Attempt (Grifando's GET /api/exercises).
    .get("/api/exercises", (context): Response | Promise<Response> => {
      const { listPendingExercises } = options;
      if (listPendingExercises === undefined) {
        return context.json(notReady("Exercises are not available"), 503);
      }
      return edge(forLearner(context.req.raw, listPendingExercises()), {
        errors: { DatabaseError: () => SOMETHING_WENT_WRONG },
        success: (pending) =>
          Response.json({ exercises: pending.map(publicView) }),
      });
    })
    .post("/api/exercises", (context): Response | Promise<Response> => {
      const { generateExercises } = options;
      if (generateExercises === undefined) {
        return context.json(notReady("Exercises are not available"), 503);
      }
      return context.req
        .json<unknown>()
        .then(
          (body) => EXERCISE_REQUEST["~standard"].validate(body),
          () => EXERCISE_REQUEST["~standard"].validate({})
        )
        .then((result) =>
          result.issues === undefined
            ? edge(
                forLearner(
                  context.req.raw,
                  generateExercises(context.req.raw.headers, result.value)
                ),
                {
                  errors: {
                    ...TRAINER_FAILURES,
                    AIResponseValidationError: () => SOMETHING_WENT_WRONG,
                    DatabaseError: () => SOMETHING_WENT_WRONG,
                  },
                  success: (created) =>
                    created.length === 0
                      ? Response.json(NO_PATTERNS, { status: 422 })
                      : Response.json(
                          { exercises: created.map(publicView) },
                          { status: 201 }
                        ),
                  unexpected: SOMETHING_WENT_WRONG,
                }
              )
            : Response.json(
                { error: "Invalid request body", issues: result.issues },
                { status: 400 }
              )
        );
    })
    // Grades one answer to the Learner's Exercise and answers with the whole Exercise, its
    // answer key included (Grifando's POST /api/exercises/[id]/attempts). No Trainer takes part.
    .post(
      "/api/exercises/:exerciseId/attempts",
      (context): Response | Promise<Response> => {
        const { submitAttempt } = options;
        if (submitAttempt === undefined) {
          return context.json(notReady("Exercises are not available"), 503);
        }
        return context.req
          .json<unknown>()
          .catch(() => null)
          .then((body) => ATTEMPT_REQUEST["~standard"].validate(body))
          .then((result) =>
            result.issues === undefined
              ? edge(
                  forLearner(
                    context.req.raw,
                    submitAttempt(
                      context.req.param("exerciseId"),
                      result.value.answer
                    )
                  ),
                  {
                    errors: {
                      DatabaseError: () => SOMETHING_WENT_WRONG,
                      NotFoundError: () => NOT_FOUND,
                    },
                    success: (graded) => Response.json(graded),
                    unexpected: SOMETHING_WENT_WRONG,
                  }
                )
              : Response.json(
                  { error: "Invalid request body", issues: result.issues },
                  { status: 400 }
                )
          );
      }
    )
    // "Explain my answer" on the key the request carries (Grifando's explanation route): the
    // key is resolved before the Attempt is read, and the explanation never changes the grade.
    .post(
      "/api/exercises/:exerciseId/attempts/:attemptId/explanation",
      (context): Response | Promise<Response> => {
        const { explainAttempt } = options;
        if (explainAttempt === undefined) {
          return context.json(notReady("Exercises are not available"), 503);
        }
        return edge(
          forLearner(
            context.req.raw,
            explainAttempt(context.req.raw.headers, {
              attemptId: context.req.param("attemptId"),
              exerciseId: context.req.param("exerciseId"),
            })
          ),
          {
            errors: {
              ...TRAINER_FAILURES,
              AIResponseValidationError: () => ({
                ...EXPLANATION_FAILED,
                status: 502,
              }),
              DatabaseError: () => EXPLANATION_FAILED,
            },
            success: (explanation) =>
              explanation === null
                ? Response.json(NOT_FOUND.body, { status: NOT_FOUND.status })
                : Response.json({ explanation }),
            unexpected: EXPLANATION_FAILED,
          }
        );
      }
    )
    // A new interview with its opening question, asked on the key the request carries
    // (Grifando's POST /api/interview): the key is resolved before the session is created.
    .post("/api/interview", (context): Response | Promise<Response> => {
      const { startInterview } = options;
      if (startInterview === undefined) {
        return context.json(INTERVIEWS_NOT_READY, 503);
      }
      return edge(
        forLearner(context.req.raw, startInterview(context.req.raw.headers)),
        {
          errors: {
            ...TRAINER_FAILURES,
            AIResponseValidationError: () => SOMETHING_WENT_WRONG,
            DatabaseError: () => SOMETHING_WENT_WRONG,
          },
          success: ({ sessionId, turn }) =>
            Response.json(
              {
                sessionId,
                turn: nextTurnView(turn),
              },
              { status: 201 }
            ),
          unexpected: SOMETHING_WENT_WRONG,
        }
      );
    })
    // The Learner's interview session with its turns in order (Grifando's
    // GET /api/interview/[id]); another Learner's session reads as missing.
    .get(
      "/api/interview/:sessionId",
      (context): Response | Promise<Response> => {
        const { getInterviewSession } = options;
        if (getInterviewSession === undefined) {
          return context.json(INTERVIEWS_NOT_READY, 503);
        }
        return edge(
          forLearner(
            context.req.raw,
            getInterviewSession(context.req.param("sessionId"))
          ),
          {
            errors: { DatabaseError: () => SOMETHING_WENT_WRONG },
            success: (session) =>
              session === null
                ? Response.json(NOT_FOUND.body, { status: NOT_FOUND.status })
                : Response.json({
                    id: session.id,
                    status: session.status,
                    turns: session.turns.map(interviewTurnView),
                  }),
            unexpected: SOMETHING_WENT_WRONG,
          }
        );
      }
    )
    // Ends the Learner's interview session (Grifando's POST /api/interview/[id]/end). No
    // Trainer takes part.
    .post(
      "/api/interview/:sessionId/end",
      (context): Response | Promise<Response> => {
        const { endInterview } = options;
        if (endInterview === undefined) {
          return context.json(INTERVIEWS_NOT_READY, 503);
        }
        return edge(
          forLearner(
            context.req.raw,
            endInterview(context.req.param("sessionId"))
          ),
          {
            errors: { DatabaseError: () => SOMETHING_WENT_WRONG },
            success: (ended) =>
              ended
                ? Response.json({ status: "ended" })
                : Response.json(NOT_FOUND.body, { status: NOT_FOUND.status }),
            unexpected: SOMETHING_WENT_WRONG,
          }
        );
      }
    )
    // One answer to the Learner's interview turn (Grifando's
    // POST /api/interview/[id]/turns/[turnId]/answer): the Judge evaluates it as practice
    // writing and the Trainer folds its Findings before the next question (docs/adr/0010,
    // docs/adr/0024). The body is checked before the key.
    .post(
      "/api/interview/:sessionId/turns/:turnId/answer",
      (context): Response | Promise<Response> => {
        const { answerInterviewTurn } = options;
        if (answerInterviewTurn === undefined) {
          return context.json(INTERVIEWS_NOT_READY, 503);
        }
        return context.req
          .json<unknown>()
          .catch(() => null)
          .then((body) => INTERVIEW_ANSWER_REQUEST["~standard"].validate(body))
          .then((result) =>
            result.issues === undefined
              ? edge(
                  forLearner(
                    context.req.raw,
                    answerInterviewTurn(context.req.raw.headers, {
                      answer: result.value.answer,
                      sessionId: context.req.param("sessionId"),
                      turnId: context.req.param("turnId"),
                    })
                  ),
                  {
                    errors: {
                      ...TRAINER_FAILURES,
                      AIResponseValidationError: () => SOMETHING_WENT_WRONG,
                      DatabaseError: () => SOMETHING_WENT_WRONG,
                      EnrichmentFailedError: ({ evaluationId }) => ({
                        body: {
                          evaluationId,
                          message: ANALYSIS_FAILURE_MESSAGE,
                          status: "failed",
                        },
                        status: 200,
                      }),
                      EvaluationModelError: judgeFailure,
                      InvalidAssessmentError: judgeFailure,
                      InvalidWritingSampleError: judgeFailure,
                      NoEnglishError: judgeFailure,
                      NotFoundError: () => NOT_FOUND,
                      UnsafeCorrectionError: judgeFailure,
                    },
                    success: (answered) => Response.json(answered),
                    unexpected: SOMETHING_WENT_WRONG,
                  }
                )
              : Response.json(
                  { error: "Invalid request body", issues: result.issues },
                  { status: 400 }
                )
          );
      }
    )
    // Today's Practice Prompt (Grifando's resolveDailyChallenge, which its /today and
    // /write?mode=daily pages read), biased toward the categories the Learner has not mastered.
    .get("/api/daily-challenge", (context): Response | Promise<Response> => {
      const { getDailyChallenge } = options;
      if (getDailyChallenge === undefined) {
        return context.json(PRACTICE_PROMPTS_NOT_READY, 503);
      }
      return edge(forLearner(context.req.raw, getDailyChallenge()), {
        errors: { DatabaseError: () => SOMETHING_WENT_WRONG },
        success: (challenge) => Response.json(challenge),
      });
    })
    // The Learner's vocabulary, newest first (Grifando's /vocabulary page read it in a Server
    // Component; docs/adr/0025).
    .get("/api/vocabulary", (context): Response | Promise<Response> => {
      const { listVocabularyItems } = options;
      if (listVocabularyItems === undefined) {
        return context.json(notReady("Vocabulary is not available"), 503);
      }
      return edge(forLearner(context.req.raw, listVocabularyItems()), {
        errors: { DatabaseError: () => SOMETHING_WENT_WRONG },
        success: (items) => Response.json({ items }),
      });
    })
    .post("/api/vocabulary", (context): Response | Promise<Response> => {
      const { createVocabularyItem } = options;
      if (createVocabularyItem === undefined) {
        return context.json(notReady("Vocabulary is not available"), 503);
      }
      return context.req
        .json<unknown>()
        .catch(() => null)
        .then((body) => VOCABULARY_REQUEST["~standard"].validate(body))
        .then((result) =>
          result.issues === undefined
            ? edge(
                forLearner(context.req.raw, createVocabularyItem(result.value)),
                {
                  errors: { DatabaseError: () => SOMETHING_WENT_WRONG },
                  success: (item) => Response.json(item, { status: 201 }),
                }
              )
            : Response.json(
                { error: "Invalid request body", issues: result.issues },
                { status: 400 }
              )
        );
    })
    .delete(
      "/api/vocabulary/:itemId",
      (context): Response | Promise<Response> => {
        const { deleteVocabularyItem } = options;
        if (deleteVocabularyItem === undefined) {
          return context.json(notReady("Vocabulary is not available"), 503);
        }
        return edge(
          forLearner(
            context.req.raw,
            deleteVocabularyItem(context.req.param("itemId"))
          ),
          {
            errors: { DatabaseError: () => SOMETHING_WENT_WRONG },
            success: (deleted) =>
              deleted
                ? new Response(null, { status: 204 })
                : Response.json({ error: "Not found" }, { status: 404 }),
          }
        );
      }
    )
    .get("/api/setup", (context) =>
      options.setup === undefined
        ? context.json(notReady("Setup status is not available"), 503)
        : context.json(options.setup)
    )
    .notFound((context) =>
      context.json({ code: "not-found", error: "Not Found" }, 404)
    )
    .onError((_error, context) =>
      context.json(INTERNAL_ERROR.body, INTERNAL_ERROR.status)
    );

  if (options.serveWeb) {
    app.get("/*", webFallback(options.webDistPath));
  }
  return app;
};

export type AppType = ReturnType<typeof createApp<never>>;

/**
 * Listens with the app on an HTTP server whose connections stay open while the Judge answers:
 * PE kept them for 120 seconds, beyond the provider's 90-second deadline.
 */
export const serveApp = (
  app: { readonly fetch: (request: Request) => Response | Promise<Response> },
  address: { readonly hostname: string; readonly port: number }
) =>
  createServer(getRequestListener(app.fetch))
    .setTimeout(HTTP_IDLE_TIMEOUT_MILLISECONDS)
    .listen(address.port, address.hostname);
