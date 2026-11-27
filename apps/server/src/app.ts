import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

import {
  AttemptRequest,
  CodeSnippet,
  ErrorCategory,
  ExerciseGenerationRequest,
  InterviewAnswerRequest,
  PracticeWritingRequest,
  ProgressEvidenceRequest,
  ProgressPeriod,
  WritingSampleRequest,
} from "@grifando/contract";
import type {
  AcademyDashboard,
  DailyChallenge,
  DeployProfileStatus,
  KeyTestResult,
  MistakeNotebook,
  HealthResponse,
  ProgressEvidenceSelection,
  SetupStatus,
  GeneratedExercise,
  AIResponseValidationError,
} from "@grifando/contract";
import {
  EVALUATION_HTTP_IDLE_TIMEOUT_SECONDS,
  EVALUATION_MAX_OUTPUT_TOKENS,
  EVALUATION_REQUEST_TIMEOUT_MILLISECONDS,
} from "@grifando/core/evaluation-request-policy";
import { toPublicExercise } from "@grifando/core/public-view";
import type { DatabaseError } from "@grifando/db";
import type { InputLimits, SessionSettings } from "@grifando/env";
import { getRequestListener } from "@hono/node-server";
import { Effect, Option, Schema } from "effect";
import { Hono } from "hono";
import type { Context as HonoContext, Handler, MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { getMimeType } from "hono/utils/mime";

import type { NotFoundError } from "./academy/errors";
import type { SubmitAttemptResult } from "./academy/exercise-service";
import type {
  AnswerTurnInput,
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
import {
  InvalidTrainerCredentialsError,
  TrainerKeyRequiredError,
} from "./academy/trainer/trainer-errors";
import type { TrainerAccessError } from "./academy/trainer/trainer-errors";
import { INTERNAL_ERROR, makeEdge } from "./edge";
import type { EdgeFailure, EdgeRuntime } from "./edge";
import { endpointFailure } from "./evaluation/evaluation-endpoint";
import type {
  EvaluationEndpointResult,
  EvaluationFailureCode,
  WritingEvaluationFailure,
} from "./evaluation/evaluation-endpoint";
import { JudgeKey, JudgeKeyRequiredError } from "./evaluation/evaluation-model";
import { CurrentLearner, LearnerIdentity } from "./learner-identity";
import type {
  EnrichmentFailedError,
  InterviewAnswer,
  PracticeWriting,
} from "./practice/practice-writing";
import { readBody } from "./request-body";
import type { BodyContext } from "./request-body";
import { sampleLimitsOf } from "./sample-limits";
import {
  securityHeaders,
  sessionCookie,
  sessionGate,
} from "./session/hosted-pipeline";
import { rateLimited } from "./session/rate-limit";
import type { RateLimitBucket, RateLimitedError } from "./session/rate-limit";
import {
  OG_IMAGE_PATH,
  robotsTxt,
  sitemapXml,
  withLinkPreview,
} from "./site-files";

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
    InterviewAnswer,
    | AIResponseValidationError
    | DatabaseError
    | EnrichmentFailedError
    | NotFoundError
    | TrainerAccessError
    | WritingEvaluationFailure,
    R | CurrentLearner
  >;
  /** The Academy dashboard: practice state, recent work and today's challenge. */
  readonly getAcademyDashboard?: () => Effect.Effect<
    AcademyDashboard,
    DatabaseError,
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
  /**
   * Counts a state-changing call against the hosted profile's rate limits, and fails when they
   * refuse it (docs/adr/0033). Without it, as in the local profile, nothing is limited.
   */
  readonly limitRequest?: (
    headers: Headers,
    bucket: RateLimitBucket
  ) => Effect.Effect<
    void,
    DatabaseError | RateLimitedError,
    R | CurrentLearner
  >;
  /** Creates the Learner's row and records the write's activity, once the rate limit passed. */
  readonly ensureLearner?: () => Effect.Effect<
    void,
    DatabaseError,
    R | CurrentLearner
  >;
  /** Deletes the hosted Learner of the request and all their data (`DELETE /api/me`). */
  readonly deleteLearner?: () => Effect.Effect<
    void,
    DatabaseError,
    R | CurrentLearner
  >;
  readonly evaluateWriting?: (
    writingSample: string,
    headers: Headers
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
  /** The Learner's Mistake Notebook: every pattern with its derived state, and the breakdowns. */
  readonly getMistakeNotebook?: () => Effect.Effect<
    MistakeNotebook,
    DatabaseError,
    R | CurrentLearner
  >;
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
  /** Practice writing on the request's key: the Judge's Evaluation, then the Enrichment's fold. */
  readonly writePractice?: (
    headers: Headers,
    writingSample: string,
    codeSnippet?: string
  ) => Effect.Effect<
    PracticeWriting,
    | AIResponseValidationError
    | DatabaseError
    | EnrichmentFailedError
    | TrainerAccessError
    | WritingEvaluationFailure,
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

/**
 * The deploy profile, with what the hosted profile needs: the session its request pipeline signs
 * and checks (docs/adr/0003, docs/adr/0032), and the public origin its robots.txt, sitemap.xml and
 * link preview name (docs/adr/0037, docs/adr/0040).
 */
export type ProfileOptions =
  | { readonly profile: "local" }
  | {
      readonly profile: "hosted";
      readonly session: SessionSettings;
      readonly siteUrl: string;
    };

export type AppOptions<R = never> = AppBoundaries<R> &
  ProfileOptions & {
    /** The input caps of the deploy profile (docs/adr/0006). */
    readonly limits: InputLimits;
    /** Runs the boundaries; it provides what they need besides the Learner of the request. */
    readonly runtime: EdgeRuntime<R | LearnerIdentity>;
    /** Whether this process also serves the web build, as it does in production. */
    readonly serveWeb: boolean;
    readonly webDistPath: string;
  };

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

const FORBIDDEN: EdgeFailure = {
  body: {
    code: "forbidden",
    error: "Only same-origin localhost access is allowed",
  },
  status: 403,
};

// What a hosted route that runs the Judge answers without an OpenRouter key (docs/adr/0035,
// decision 4). The Learner reads the message, which names the key the Judge needs and where it
// goes.
const JUDGE_KEY_REQUIRED: EdgeFailure = {
  body: {
    code: "AI_JUDGE_KEY_REQUIRED",
    error:
      "Set up an OpenRouter key in Settings to get feedback on your writing.",
  },
  status: 401,
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

// What a profile without a step of the pipeline runs in its place.
const passThrough: MiddlewareHandler = (_context, next) => next();

// Every API answer is marked as not storable.
const markApi = (context: HonoContext) => {
  if (context.req.path.startsWith("/api/")) {
    context.header("cache-control", "no-store");
  }
};

/**
 * Runs before every route: it refuses a foreign request and a body over the cap, and marks every
 * API answer as not storable. A declared length over the cap is refused before any byte is read;
 * a body that declares none, as a chunked request does, is counted as it arrives (HR-02, #272).
 * An accepted request gets the header once its answer exists, because a route may answer with a
 * `Response` of its own, as the edge helper does.
 */
const guard = (
  options: Pick<AppOptions, "limits" | "profile">
): MiddlewareHandler => {
  const capBody = bodyLimit({
    maxSize: options.limits.bodyMaxBytes,
    onError: (context) => {
      markApi(context);
      return context.json(SAMPLE_TOO_LARGE.body, SAMPLE_TOO_LARGE.status);
    },
  });

  return (context, next) => {
    const refusal = refusalOf(context.req.raw, options);
    if (refusal !== undefined) {
      markApi(context);
      return Promise.resolve(context.json(refusal.body, refusal.status));
    }
    const marked = () => {
      markApi(context);
    };
    return capBody(context, () => next().then(marked));
  };
};

// A file of the web build with its headers, or a 404 when it cannot be read.
const serveFile = (
  context: HonoContext,
  file: string,
  headers: Record<string, string>
) =>
  readFile(file).then(
    (body) => context.body(body, 200, headers),
    () => context.text("Not Found", 404)
  );

/**
 * Answers every GET that no API route took. Only files under `assets/` of the web build are
 * served, and the path is never decoded, so no request reaches a file outside that directory.
 * Any other path is a browser route and gets the application shell, as `shell` writes it.
 */
const webFallback = (
  webDistPath: string,
  shell: (html: string) => string
): Handler => {
  const root = path.resolve(webDistPath);
  const index = path.resolve(root, "index.html");

  return (context) => {
    if (context.req.path.startsWith("/api/")) {
      return context.json({ error: "Not Found" }, 404);
    }

    const requestPath = new URL(context.req.url).pathname;
    if (!requestPath.startsWith("/assets/")) {
      return readFile(index, "utf-8").then((html) =>
        context.html(shell(html), 200, { "cache-control": "no-cache" })
      );
    }

    const assetPath = path.resolve(root, `.${requestPath}`);
    if (!assetPath.startsWith(`${root}${path.sep}`)) {
      return context.text("Not Found", 404);
    }
    return serveFile(context, assetPath, {
      "cache-control": "public, max-age=31536000, immutable",
      "content-type": getMimeType(assetPath) ?? "application/octet-stream",
    });
  };
};

/** Grifando's Open Graph card from the root of the web build (docs/adr/0040). */
const ogImage = (webDistPath: string): Handler => {
  const card = path.resolve(webDistPath, `.${OG_IMAGE_PATH}`);

  return (context) =>
    serveFile(context, card, {
      "cache-control": "public, max-age=86400",
      "content-type": "image/png",
    });
};

const asBuilt = (html: string) => html;

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

// PE's Evaluation route refused every body but a Writing Sample with one answer.
const WRITING_SAMPLE_REQUEST = Schema.toStandardSchemaV1(WritingSampleRequest);

// Both evidence routes refuse a selection they cannot read with one answer.
const EVIDENCE_REQUEST = Schema.toStandardSchemaV1(ProgressEvidenceRequest);

// A failure with a message the Learner can act on.
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
const ENRICHMENT_FAILURE_MESSAGE =
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

// Grifando's writing route answered every issue of a refused body (src/app/api/writing-sessions,
// 74dbb9f); a body that is not JSON is refused too. Explain code's snippet is trimmed, never
// blank, and within the Deploy Profile's code cap, which only the hosted profile sets
// (docs/adr/0006, docs/adr/0038).
const practiceWritingRequest = (limits: InputLimits) =>
  Schema.toStandardSchemaV1(
    Schema.Struct({
      ...PracticeWritingRequest.fields,
      codeSnippet: Schema.optionalKey(
        Option.match(limits.codeMaxCharacters, {
          onNone: () => CodeSnippet,
          onSome: (maximum) => CodeSnippet.check(Schema.isMaxLength(maximum)),
        })
      ),
    }),
    { parseOptions: { errors: "all" } }
  );

/** The idle time a connection keeps while the Judge answers, beyond its own deadline. */
export const HTTP_IDLE_TIMEOUT_MILLISECONDS =
  EVALUATION_HTTP_IDLE_TIMEOUT_SECONDS * 1000;

/**
 * The HTTP application: the API and, in production, the web build, from one process. Routes
 * answer from Effects through the edge helper (`./edge`).
 */
export const createApp = <R = never>(options: AppOptions<R>) => {
  const edge = makeEdge(options.runtime);
  const practiceWritingBody = practiceWritingRequest(options.limits);
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
          // The session gate refuses an API request without a valid session before any route
          // runs, so a route that meets one has a defect (docs/adr/0032).
          const id = yield* identity.identify(request).pipe(Effect.orDie);
          return CurrentLearner.of({ id });
        })
      )
    );
  const failedHistory = { DatabaseError: () => INTERNAL_ERROR };

  // A state-changing call, admitted in Grifando's order (fix 9ba8040): the rate limit, then the
  // Learner's row, then the route's own work (docs/adr/0033). Without the boundaries, as in the
  // local profile, the work runs as it is.
  const admitted = <A, E>(
    request: Request,
    bucket: RateLimitBucket,
    effect: Effect.Effect<A, E, R | CurrentLearner>
  ) => {
    const { ensureLearner, limitRequest } = options;
    return (
      limitRequest === undefined
        ? Effect.void
        : limitRequest(request.headers, bucket)
    ).pipe(
      Effect.andThen(
        ensureLearner === undefined ? Effect.void : ensureLearner()
      ),
      Effect.andThen(effect)
    );
  };
  // A route that calls the Trainer checks the visitor's key first, as Grifando's did: a request
  // without a usable key is not counted, and the route answers it for its key. The hosted profile
  // reads keys from request headers only (docs/adr/0012).
  const admittedWithTrainerKey = <A, E>(
    request: Request,
    bucket: RateLimitBucket,
    effect: Effect.Effect<A, E, R | CurrentLearner>
  ) =>
    readTrainerCredentials(request.headers).pipe(
      Effect.matchEffect({
        onFailure: () => effect,
        onSuccess: (credentials) =>
          credentials === null ? effect : admitted(request, bucket, effect),
      })
    );

  // The hosted profile's Judge runs on the visitor's OpenRouter key (docs/adr/0035). A request
  // that carries one runs its work on that key; a request with no key, or with a key for another
  // provider, answers AI_JUDGE_KEY_REQUIRED before its rate limit (decision 4); a request whose
  // key cannot be read fails with `unreadableKey`, the route's own answer for it (#263). The
  // local profile's Judge runs on its configured key, so it reads none from the request.
  const withJudgeKey = <A, E, E2>(
    request: Request,
    work: Effect.Effect<A, E, R | CurrentLearner>,
    unreadableKey: E2
  ): Effect.Effect<A, E | E2 | JudgeKeyRequiredError, R | CurrentLearner> =>
    options.profile === "local"
      ? work
      : readTrainerCredentials(request.headers).pipe(
          Effect.matchEffect({
            onFailure: () => Effect.fail(unreadableKey),
            onSuccess: (
              credentials
            ): Effect.Effect<
              A,
              E | JudgeKeyRequiredError,
              R | CurrentLearner
            > =>
              credentials?.provider === "openrouter"
                ? work.pipe(
                    Effect.provideService(
                      JudgeKey,
                      JudgeKey.of({ apiKey: credentials.apiKey })
                    )
                  )
                : Effect.fail(new JudgeKeyRequiredError()),
          })
        );

  // A route that runs the Trainer and the Judge needs, in the hosted profile, the one key that
  // serves both: an OpenRouter key (docs/adr/0035). A request without one asks for it, as an
  // Evaluation does, rather than for any Trainer key (#251); a key that cannot be read answers
  // AI_KEY_INVALID, as on every Trainer route (#263). The local profile's Judge runs on its
  // configured key, and its Trainer key is checked as any Trainer route's.
  const admittedWithTrainerAndJudgeKeys = <A, E>(
    request: Request,
    bucket: RateLimitBucket,
    effect: Effect.Effect<A, E, R | CurrentLearner>
  ) =>
    withJudgeKey(
      request,
      admittedWithTrainerKey(request, bucket, effect),
      new InvalidTrainerCredentialsError()
    );

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
      forLearner(
        context.req.raw,
        withJudgeKey(
          context.req.raw,
          admitted(
            context.req.raw,
            "analysis",
            evaluateWriting(writingSample, context.req.raw.headers)
          ),
          new JudgeKeyRequiredError()
        )
      ).pipe(
        Effect.tapDefect(() =>
          Effect.sync(() => {
            log("internal-error");
          })
        )
      ),
      {
        errors: {
          DatabaseError: () => INTERNAL_ERROR,
          JudgeKeyRequiredError: () => JUDGE_KEY_REQUIRED,
          RateLimitedError: rateLimited,
        },
        success: (result) => {
          log(resultCode(result));
          return context.json(result, resultStatus(result));
        },
      }
    ).then(withCorrelation);
  };

  const app = new Hono()
    .use(options.profile === "hosted" ? securityHeaders : passThrough)
    .use(guard(options))
    .use(
      options.profile === "hosted" ? sessionGate(options.session) : passThrough
    )
    .get("/api/health", (context) =>
      context.json({ status: "ok" } satisfies HealthResponse)
    )
    .post(
      "/api/evaluations",
      (
        context: BodyContext<typeof WritingSampleRequest, "/api/evaluations">
      ): Promise<Response> =>
        readBody(context, WRITING_SAMPLE_REQUEST, null).then((result) =>
          result.issues === undefined
            ? evaluate(context, result.value.writingSample)
            : context.json(INVALID_REQUEST, 400)
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
            admitted(
              context.req.raw,
              "write",
              deleteEvaluation(context.req.param("evaluationId"))
            )
          ),
          {
            errors: { ...failedHistory, RateLimitedError: rateLimited },
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
    .post(
      "/api/progress/evidence",
      (
        context: BodyContext<
          typeof ProgressEvidenceRequest,
          "/api/progress/evidence"
        >
      ): Response | Promise<Response> => {
        const { getProgressEvidence } = options;
        if (getProgressEvidence === undefined) {
          return context.json(PROGRESS_NOT_READY, 503);
        }
        return readBody(context, EVIDENCE_REQUEST, null).then((result) =>
          evidence(
            context,
            getProgressEvidence,
            result.issues === undefined
              ? Option.some(result.value)
              : Option.none()
          )
        );
      }
    )
    // Tests the key the Learner's browser sends, read from the request headers only: the local
    // profile's configured key is never tested. A malformed key reads as invalid at once.
    .post("/api/ai-key/test", (context): Response | Promise<Response> => {
      const { testTrainerKey } = options;
      if (testTrainerKey === undefined) {
        return context.json(notReady("Key tests are not available"), 503);
      }
      // Grifando's order: the key's shape, then the rate limit, then the provider.
      type KeyTest = Effect.Effect<
        KeyTestStatus,
        DatabaseError | RateLimitedError | TrainerKeyRequiredError,
        R | CurrentLearner
      >;
      const tested = readTrainerCredentials(context.req.raw.headers).pipe(
        Effect.matchEffect({
          onFailure: (): KeyTest => Effect.succeed("invalid"),
          onSuccess: (credentials): KeyTest =>
            credentials === null
              ? Effect.fail(new TrainerKeyRequiredError())
              : admitted(
                  context.req.raw,
                  "keyTest",
                  testTrainerKey(credentials)
                ),
        })
      );
      return edge(forLearner(context.req.raw, tested), {
        errors: {
          DatabaseError: () => INTERNAL_ERROR,
          RateLimitedError: rateLimited,
          TrainerKeyRequiredError: trainerFailure,
        },
        success: (status) => Response.json({ status } satisfies KeyTestResult),
      });
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
        log: "Failed to list exercises",
        success: (pending) =>
          Response.json({ exercises: pending.map(publicView) }),
      });
    })
    .post(
      "/api/exercises",
      (
        context: BodyContext<typeof ExerciseGenerationRequest, "/api/exercises">
      ): Response | Promise<Response> => {
        const { generateExercises } = options;
        if (generateExercises === undefined) {
          return context.json(notReady("Exercises are not available"), 503);
        }
        return readBody(context, EXERCISE_REQUEST, {}).then((result) =>
          result.issues === undefined
            ? edge(
                forLearner(
                  context.req.raw,
                  admittedWithTrainerKey(
                    context.req.raw,
                    "generation",
                    generateExercises(context.req.raw.headers, result.value)
                  )
                ),
                {
                  errors: {
                    ...TRAINER_FAILURES,
                    AIResponseValidationError: () => SOMETHING_WENT_WRONG,
                    DatabaseError: () => SOMETHING_WENT_WRONG,
                    RateLimitedError: rateLimited,
                  },
                  log: "Failed to generate exercises",
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
      }
    )
    // Grades one answer to the Learner's Exercise and answers with the whole Exercise, its
    // answer key included (Grifando's POST /api/exercises/[id]/attempts). No Trainer takes part.
    .post(
      "/api/exercises/:exerciseId/attempts",
      (
        context: BodyContext<
          typeof AttemptRequest,
          "/api/exercises/:exerciseId/attempts"
        >
      ): Response | Promise<Response> => {
        const { submitAttempt } = options;
        if (submitAttempt === undefined) {
          return context.json(notReady("Exercises are not available"), 503);
        }
        return readBody(context, ATTEMPT_REQUEST, null).then((result) =>
          result.issues === undefined
            ? edge(
                forLearner(
                  context.req.raw,
                  admitted(
                    context.req.raw,
                    "write",
                    submitAttempt(
                      context.req.param("exerciseId"),
                      result.value.answer
                    )
                  )
                ),
                {
                  errors: {
                    DatabaseError: () => SOMETHING_WENT_WRONG,
                    NotFoundError: () => NOT_FOUND,
                    RateLimitedError: rateLimited,
                  },
                  log: "Failed to submit exercise attempt",
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
            admittedWithTrainerKey(
              context.req.raw,
              "analysis",
              explainAttempt(context.req.raw.headers, {
                attemptId: context.req.param("attemptId"),
                exerciseId: context.req.param("exerciseId"),
              })
            )
          ),
          {
            errors: {
              ...TRAINER_FAILURES,
              AIResponseValidationError: () => ({
                ...EXPLANATION_FAILED,
                status: 502,
              }),
              DatabaseError: () => EXPLANATION_FAILED,
              RateLimitedError: rateLimited,
            },
            log: "Failed to explain exercise attempt",
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
        forLearner(
          context.req.raw,
          admittedWithTrainerKey(
            context.req.raw,
            "generation",
            startInterview(context.req.raw.headers)
          )
        ),
        {
          errors: {
            ...TRAINER_FAILURES,
            AIResponseValidationError: () => SOMETHING_WENT_WRONG,
            DatabaseError: () => SOMETHING_WENT_WRONG,
            RateLimitedError: rateLimited,
          },
          log: "Failed to start interview",
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
            log: "Failed to fetch interview session",
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
            admitted(
              context.req.raw,
              "write",
              endInterview(context.req.param("sessionId"))
            )
          ),
          {
            errors: {
              DatabaseError: () => SOMETHING_WENT_WRONG,
              RateLimitedError: rateLimited,
            },
            log: "Failed to end interview session",
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
      (
        context: BodyContext<
          typeof InterviewAnswerRequest,
          "/api/interview/:sessionId/turns/:turnId/answer"
        >
      ): Response | Promise<Response> => {
        const { answerInterviewTurn } = options;
        if (answerInterviewTurn === undefined) {
          return context.json(INTERVIEWS_NOT_READY, 503);
        }
        return readBody(context, INTERVIEW_ANSWER_REQUEST, null).then(
          (result) =>
            result.issues === undefined
              ? edge(
                  forLearner(
                    context.req.raw,
                    admittedWithTrainerAndJudgeKeys(
                      context.req.raw,
                      "analysis",
                      answerInterviewTurn(context.req.raw.headers, {
                        answer: result.value.answer,
                        sessionId: context.req.param("sessionId"),
                        turnId: context.req.param("turnId"),
                      })
                    )
                  ),
                  {
                    errors: {
                      ...TRAINER_FAILURES,
                      AIResponseValidationError: () => SOMETHING_WENT_WRONG,
                      DatabaseError: () => SOMETHING_WENT_WRONG,
                      EnrichmentFailedError: ({ evaluationId }) => ({
                        body: {
                          evaluationId,
                          message: ENRICHMENT_FAILURE_MESSAGE,
                          status: "failed",
                        },
                        status: 200,
                      }),
                      EvaluationModelError: judgeFailure,
                      InvalidAssessmentError: judgeFailure,
                      InvalidWritingSampleError: judgeFailure,
                      JudgeKeyRequiredError: () => JUDGE_KEY_REQUIRED,
                      NoEnglishError: judgeFailure,
                      NotFoundError: () => NOT_FOUND,
                      RateLimitedError: rateLimited,
                      UnsafeCorrectionError: judgeFailure,
                    },
                    log: "Failed to answer interview turn",
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
    // The Academy dashboard (Grifando's / page read it in a Server Component; docs/adr/0025).
    .get("/api/academy/dashboard", (context): Response | Promise<Response> => {
      const { getAcademyDashboard } = options;
      if (getAcademyDashboard === undefined) {
        return context.json(notReady("The Academy is not available"), 503);
      }
      return edge(forLearner(context.req.raw, getAcademyDashboard()), {
        errors: { DatabaseError: () => SOMETHING_WENT_WRONG },
        log: "Failed to read the Academy dashboard",
        success: (dashboard) => Response.json(dashboard),
      });
    })
    // Today's Practice Prompt (Grifando's resolveDailyChallenge, which its /today and
    // /write?mode=daily pages read), biased toward the categories the Learner has not mastered.
    .get("/api/daily-challenge", (context): Response | Promise<Response> => {
      const { getDailyChallenge } = options;
      if (getDailyChallenge === undefined) {
        return context.json(PRACTICE_PROMPTS_NOT_READY, 503);
      }
      return edge(forLearner(context.req.raw, getDailyChallenge()), {
        errors: { DatabaseError: () => SOMETHING_WENT_WRONG },
        log: "Failed to read today's challenge",
        success: (challenge) => Response.json(challenge),
      });
    })
    // The Learner's Mistake Notebook (Grifando's /mistakes page read it in a Server Component):
    // the page applies its time range and origin filters itself (docs/adr/0025).
    .get("/api/mistakes", (context): Response | Promise<Response> => {
      const { getMistakeNotebook } = options;
      if (getMistakeNotebook === undefined) {
        return context.json(notReady("Mistakes are not available"), 503);
      }
      return edge(forLearner(context.req.raw, getMistakeNotebook()), {
        errors: { DatabaseError: () => SOMETHING_WENT_WRONG },
        log: "Failed to read the Mistake Notebook",
        success: (notebook) => Response.json(notebook),
      });
    })
    // Practice writing (Grifando's POST /api/writing-sessions, docs/adr/0026): the Judge
    // evaluates the text as a practice Writing Sample and the Trainer folds its Findings. The
    // key is resolved first; a failed Enrichment keeps the Evaluation and answers 201, as
    // Grifando answered with its FAILED session.
    .post(
      "/api/practice-writing",
      (
        context: BodyContext<
          typeof PracticeWritingRequest,
          "/api/practice-writing"
        >
      ): Response | Promise<Response> => {
        const { writePractice } = options;
        if (writePractice === undefined) {
          return context.json(
            notReady("Practice writing is not available"),
            503
          );
        }
        return readBody(context, practiceWritingBody, null).then((result) =>
          result.issues === undefined
            ? edge(
                forLearner(
                  context.req.raw,
                  admittedWithTrainerAndJudgeKeys(
                    context.req.raw,
                    "analysis",
                    writePractice(
                      context.req.raw.headers,
                      result.value.writingSample,
                      result.value.codeSnippet
                    )
                  )
                ),
                {
                  errors: {
                    ...TRAINER_FAILURES,
                    AIResponseValidationError: () => SOMETHING_WENT_WRONG,
                    DatabaseError: () => SOMETHING_WENT_WRONG,
                    EnrichmentFailedError: ({ evaluationId }) => ({
                      body: {
                        evaluationId,
                        message: ENRICHMENT_FAILURE_MESSAGE,
                        status: "failed",
                      },
                      status: 201,
                    }),
                    EvaluationModelError: judgeFailure,
                    InvalidAssessmentError: judgeFailure,
                    InvalidWritingSampleError: judgeFailure,
                    JudgeKeyRequiredError: () => JUDGE_KEY_REQUIRED,
                    NoEnglishError: judgeFailure,
                    RateLimitedError: rateLimited,
                    UnsafeCorrectionError: judgeFailure,
                  },
                  log: "Failed to evaluate practice writing",
                  success: ({ evaluation, naturalVersion, occurrences }) =>
                    Response.json(
                      {
                        evaluation,
                        naturalVersion,
                        occurrences,
                        status: "evaluated",
                      },
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
      }
    )
    // A hosted Learner deletes themselves and all their data, and the session cookie expires, so
    // the next page load mints a new session (Grifando src/app/api/me/route.ts, docs/adr/0003).
    // The local profile has no such route.
    .delete("/api/me", (context): Response | Promise<Response> => {
      if (options.profile === "local") {
        return context.notFound();
      }
      const { deleteLearner } = options;
      if (deleteLearner === undefined) {
        return context.json(notReady("Deletion is not available"), 503);
      }
      const expired = sessionCookie("", 0, options.session.secureCookie);
      return edge(
        forLearner(
          context.req.raw,
          admitted(context.req.raw, "write", deleteLearner())
        ),
        {
          errors: {
            DatabaseError: () => INTERNAL_ERROR,
            RateLimitedError: rateLimited,
          },
          log: "Failed to delete the Learner's data",
          success: () =>
            new Response(null, {
              headers: { "Set-Cookie": expired },
              status: 204,
            }),
        }
      );
    })
    // The Deploy Profile's caps on one Writing Sample, which size the Academy's writing sheets
    // (docs/adr/0006).
    .get("/api/sample-limits", (context) =>
      context.json(sampleLimitsOf(options.limits))
    )
    // The Deploy Profile this process runs in, which the SPA reads once at startup: only the
    // hosted profile sends the browser's AI key (docs/adr/0012, docs/adr/0034).
    .get("/api/deploy-profile", (context) =>
      context.json({
        deployProfile: options.profile,
      } satisfies DeployProfileStatus)
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

  // Grifando's robots.txt and sitemap.xml, in the hosted profile only: the local profile is
  // reachable from its own machine alone (docs/adr/0037).
  if (options.profile === "hosted") {
    const { siteUrl } = options;
    app.get("/robots.txt", (context) =>
      context.body(robotsTxt(siteUrl), 200, {
        "content-type": "text/plain; charset=UTF-8",
      })
    );
    app.get("/sitemap.xml", (context) =>
      context.body(sitemapXml(siteUrl), 200, {
        "content-type": "application/xml",
      })
    );
  }
  // The hosted profile serves Grifando's Open Graph card and names it in the shell at its public
  // origin; the local profile serves the shell as built (docs/adr/0040).
  if (options.serveWeb) {
    if (options.profile === "hosted") {
      app.get(OG_IMAGE_PATH, ogImage(options.webDistPath));
    }
    app.get(
      "/*",
      webFallback(
        options.webDistPath,
        options.profile === "hosted"
          ? withLinkPreview(options.siteUrl)
          : asBuilt
      )
    );
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
