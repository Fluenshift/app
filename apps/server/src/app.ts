import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

import {
  ErrorCategory,
  ProgressEvidenceRequest,
  ProgressPeriod,
  VocabularyItemRequest,
} from "@fluenshift/contract";
import type {
  HealthResponse,
  ProgressEvidenceSelection,
  SetupStatus,
} from "@fluenshift/contract";
import {
  EVALUATION_HTTP_IDLE_TIMEOUT_SECONDS,
  EVALUATION_MAX_OUTPUT_TOKENS,
  EVALUATION_REQUEST_TIMEOUT_MILLISECONDS,
} from "@fluenshift/core/evaluation-request-policy";
import type { DatabaseError } from "@fluenshift/db";
import type { DeployProfile, InputLimits } from "@fluenshift/env";
import { getRequestListener } from "@hono/node-server";
import { Effect, Option, Schema } from "effect";
import { Hono } from "hono";
import type { Context as HonoContext, Handler, MiddlewareHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { getMimeType } from "hono/utils/mime";

import {
  readTrainerCredentials,
  trainerFailure,
} from "./academy/trainer/credentials";
import type {
  KeyTestStatus,
  TrainerCredentials,
} from "./academy/trainer/trainer-client";
import { TrainerKeyRequiredError } from "./academy/trainer/trainer-errors";
import { INTERNAL_ERROR, makeEdge } from "./edge";
import type { EdgeFailure, EdgeRuntime } from "./edge";
import type {
  EvaluationEndpointResult,
  EvaluationFailureCode,
} from "./evaluation/evaluation-endpoint";
import { CurrentLearner, LearnerIdentity } from "./learner-identity";

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
  /** Whether the Learner had an item with that id, which is now deleted. */
  readonly deleteVocabularyItem?: (
    id: string
  ) => Effect.Effect<boolean, DatabaseError, R | CurrentLearner>;
  /** One tiny call with the Learner's key (TrainerClient.testKey). */
  readonly testTrainerKey?: (
    credentials: TrainerCredentials
  ) => Effect.Effect<KeyTestStatus, never, R>;
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
