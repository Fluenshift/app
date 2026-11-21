// The only module that talks to the server: the HTTP Evaluation client, over Hono's typed client,
// the HTTP Academy client beside it (docs/adr/0025), and the Deploy Profile the SPA reads at
// startup (docs/adr/0034). The Evaluation client is ported from PE
// apps/web/src/features/evaluations/http-evaluation-client.ts (5e831bb). Every answer is decoded
// with its contract (docs/adr/0007), and a Progress selection travels in a request body, never in
// the URL (docs/adr/0008).
import {
  TRAINER_KEY_HEADER,
  TRAINER_PROVIDER_HEADER,
  AcademyDashboard,
  AttemptExplanation,
  DailyChallenge,
  DeployProfileStatus,
  Evaluation,
  EvaluationSubmissionResult,
  EvaluationSummary,
  GradedAttempt,
  InterviewAnswerResult,
  KeyTestResult,
  MistakeNotebook,
  PendingExerciseList,
  PracticeWritingResult,
  SampleLimits,
  StartedInterview,
  ProgressEvidence,
  ProgressSummary,
  SetupStatus,
  VocabularyList,
} from "@fluenshift/contract";
import type { DeployProfile } from "@fluenshift/contract";
import { Option, Schema } from "effect";
import { hc } from "hono/client";
import type { AppType } from "server/app";

import { AcademyRequestError } from "./features/academy/academy-client";
import type { AcademyClient } from "./features/academy/academy-client";
import { EvaluationRequestError } from "./features/evaluations/evaluation-client";
import type {
  ApiFailure,
  EvaluationClient,
} from "./features/evaluations/evaluation-client";
import {
  getStoredAIKey,
  MissingAIKeyError,
} from "./features/settings/ai-key-store";

/**
 * fetch for the routes that call the Trainer in the hosted profile: it attaches the stored key in
 * its two headers, and nowhere else, never in a URL, a body or a log (docs/adr/0012). Ported from
 * Grifando src/lib/aiFetch.ts (74dbb9f), with its fix 2a86084: same-origin paths only, so the key
 * never reaches another host. `send` is the fetch that sends the request, the browser's unless a
 * client was given its own.
 */
export const aiFetch = (
  input: string,
  init?: RequestInit,
  send: typeof globalThis.fetch = globalThis.fetch
): Promise<Response> => {
  if (!input.startsWith("/") || input.startsWith("//")) {
    return Promise.reject(
      new Error("aiFetch only accepts same-origin paths like /api/...")
    );
  }
  const credentials = getStoredAIKey();
  if (credentials === null) {
    return Promise.reject(new MissingAIKeyError());
  }
  const headers = new Headers(init?.headers);
  headers.set(TRAINER_PROVIDER_HEADER, credentials.provider);
  headers.set(TRAINER_KEY_HEADER, credentials.apiKey);
  return send(input, { ...init, headers });
};

// The fetch of the Trainer's calls in the hosted profile. Hono's client hands fetch a path, which
// aiFetch checks; anything else is refused as another origin would be.
const keyedFetch =
  (send?: typeof globalThis.fetch): typeof globalThis.fetch =>
  (input, init) =>
    typeof input === "string"
      ? aiFetch(input, init, send)
      : Promise.reject(
          new Error("aiFetch only accepts same-origin paths like /api/...")
        );

interface HttpEvaluationClientOptions {
  readonly fetch?: typeof globalThis.fetch;
}

interface HttpClientOptions extends HttpEvaluationClientOptions {
  /** In the hosted profile the Trainer calls carry the browser's AI key (docs/adr/0034). */
  readonly deployProfile?: DeployProfile;
}

interface ApiResponse {
  readonly json: () => Promise<unknown>;
  readonly ok: boolean;
  readonly status: number;
}

/** The part of a failed answer the client keeps: its code and retry flag, never its message. */
const ApiFailureBody = Schema.Struct({
  code: Schema.optionalKey(Schema.String),
  retryable: Schema.optionalKey(Schema.Boolean),
});

const decodeFailure = Schema.decodeUnknownOption(ApiFailureBody);
const decodeDeployProfile = Schema.decodeUnknownOption(DeployProfileStatus);
const decodeEvaluation = Schema.decodeUnknownOption(Evaluation);
const decodeSubmission = Schema.decodeUnknownOption(EvaluationSubmissionResult);
const decodeSummaries = Schema.decodeUnknownOption(
  Schema.Array(EvaluationSummary)
);
const decodeProgressSummary = Schema.decodeUnknownOption(ProgressSummary);
const decodeProgressEvidence = Schema.decodeUnknownOption(ProgressEvidence);
const decodeSetupStatus = Schema.decodeUnknownOption(SetupStatus);
const decodeDailyChallenge = Schema.decodeUnknownOption(DailyChallenge);
const decodeAcademyDashboard = Schema.decodeUnknownOption(AcademyDashboard);
const decodeVocabularyList = Schema.decodeUnknownOption(VocabularyList);
const decodeMistakeNotebook = Schema.decodeUnknownOption(MistakeNotebook);
const decodeSampleLimits = Schema.decodeUnknownOption(SampleLimits);
const decodePendingExercises = Schema.decodeUnknownOption(PendingExerciseList);
const decodeGradedAttempt = Schema.decodeUnknownOption(GradedAttempt);
const decodeAttemptExplanation = Schema.decodeUnknownOption(AttemptExplanation);
const decodePracticeWriting = Schema.decodeUnknownOption(PracticeWritingResult);
const decodeStartedInterview = Schema.decodeUnknownOption(StartedInterview);
const decodeInterviewAnswer = Schema.decodeUnknownOption(InterviewAnswerResult);
const decodeKeyTest = Schema.decodeUnknownOption(KeyTestResult);

/** What a failed Academy answer says: its code and the message its route wrote for the Learner. */
const AcademyFailureBody = Schema.Struct({
  code: Schema.optionalKey(Schema.String),
  error: Schema.optionalKey(Schema.String),
});
const decodeAcademyFailure = Schema.decodeUnknownOption(AcademyFailureBody);

const academyJson = async <A>(
  response: ApiResponse,
  decode: (payload: unknown) => Option.Option<A>
): Promise<A> => {
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new AcademyRequestError(
      response.status,
      Option.getOrUndefined(decodeAcademyFailure(payload))
    );
  }
  return Option.getOrThrowWith(
    decode(payload),
    () => new AcademyRequestError(response.status)
  );
};

const parseJson = async (response: ApiResponse): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
};

const failureOf = (payload: unknown): ApiFailure | undefined =>
  Option.getOrUndefined(decodeFailure(payload));

const requireJson = async <A>(
  response: ApiResponse,
  decode: (payload: unknown) => Option.Option<A>
): Promise<A> => {
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new EvaluationRequestError(response, failureOf(payload));
  }
  return Option.getOrThrowWith(
    decode(payload),
    () => new EvaluationRequestError(response)
  );
};

/**
 * The Deploy Profile the server runs in, read once at startup (docs/adr/0034). An answer that
 * fails or does not decode reads as the local profile, which never sends a key from the browser.
 */
export const readDeployProfile = async ({
  fetch,
}: HttpEvaluationClientOptions = {}): Promise<DeployProfile> => {
  const { api } = hc<AppType>("/", fetch === undefined ? {} : { fetch });
  try {
    const response = await api["deploy-profile"].$get();
    const status = response.ok
      ? decodeDeployProfile(await parseJson(response))
      : Option.none();
    return Option.isSome(status) ? status.value.deployProfile : "local";
  } catch {
    return "local";
  }
};

// Hono's client puts a path parameter into the URL as it is, so the identity is encoded here.
const identity = (evaluationId: string) => ({
  param: { evaluationId: encodeURIComponent(evaluationId) },
});

export const createHttpEvaluationClient = ({
  fetch,
}: HttpClientOptions = {}): EvaluationClient => {
  const { api } = hc<AppType>("/", fetch === undefined ? {} : { fetch });

  return {
    async deleteEvaluation(evaluationId) {
      const response = await api.evaluations[":evaluationId"].$delete(
        identity(evaluationId)
      );
      if (!response.ok) {
        throw new EvaluationRequestError(
          response,
          failureOf(await parseJson(response))
        );
      }
    },

    async evaluateWriting(writingSample) {
      const response = await api.evaluations.$post({ json: { writingSample } });
      const payload = await parseJson(response);
      if (
        response.status === 422 &&
        typeof payload === "object" &&
        payload !== null &&
        "kind" in payload &&
        payload.kind === "no-english"
      ) {
        return { kind: "no-english" };
      }
      if (!response.ok || payload === undefined) {
        throw new EvaluationRequestError(response, failureOf(payload));
      }
      return Option.getOrThrowWith(
        decodeSubmission(payload),
        () => new EvaluationRequestError(response)
      );
    },

    async getEvaluation(evaluationId) {
      const response = await api.evaluations[":evaluationId"].$get(
        identity(evaluationId)
      );
      if (response.status === 404) {
        return null;
      }
      return requireJson(response, decodeEvaluation);
    },

    async getProgressEvidence({ period, selection }) {
      return requireJson(
        await api.progress.evidence.$post({ json: { period, selection } }),
        decodeProgressEvidence
      );
    },

    async getProgressSummary({ period }) {
      return requireJson(
        await api.progress.$get({ query: { period } }),
        decodeProgressSummary
      );
    },

    async getSetupStatus() {
      return requireJson(await api.setup.$get(), decodeSetupStatus);
    },

    async listEvaluations() {
      return requireJson(await api.evaluations.$get(), decodeSummaries);
    },
  };
};

export const createHttpAcademyClient = ({
  deployProfile = "local",
  fetch,
}: HttpClientOptions = {}): AcademyClient => {
  const { api } = hc<AppType>("/", fetch === undefined ? {} : { fetch });
  // The calls that reach the Trainer, Grifando's aiFetch calls: in the hosted profile they carry
  // the browser's key, and no other call does (docs/adr/0012, docs/adr/0034).
  const trainer =
    deployProfile === "hosted"
      ? hc<AppType>("/", { fetch: keyedFetch(fetch) }).api
      : api;

  return {
    async answerInterviewTurn(sessionId, turnId, answer) {
      // The route reads its body itself, so the typed client takes no JSON for it.
      return academyJson(
        await trainer.interview[":sessionId"].turns[":turnId"].answer.$post(
          {
            param: {
              sessionId: encodeURIComponent(sessionId),
              turnId: encodeURIComponent(turnId),
            },
          },
          {
            init: {
              body: JSON.stringify({ answer }),
              headers: { "content-type": "application/json" },
            },
          }
        ),
        decodeInterviewAnswer
      );
    },

    async createVocabularyItem(request) {
      const response = await api.vocabulary.$post({ json: request });
      if (!response.ok) {
        throw new AcademyRequestError(
          response.status,
          Option.getOrUndefined(decodeAcademyFailure(await parseJson(response)))
        );
      }
    },

    // A 404 means the item is already gone, as when another tab removed it.
    async deleteVocabularyItem(itemId) {
      const response = await api.vocabulary[":itemId"].$delete({
        param: { itemId: encodeURIComponent(itemId) },
      });
      if (!response.ok && response.status !== 404) {
        throw new AcademyRequestError(
          response.status,
          Option.getOrUndefined(decodeAcademyFailure(await parseJson(response)))
        );
      }
    },

    // Ending is best-effort: the wrap-up shows whatever the route answers.
    async endInterview(sessionId) {
      await api.interview[":sessionId"].end.$post({
        param: { sessionId: encodeURIComponent(sessionId) },
      });
    },

    async explainAttempt(exerciseId, attemptId) {
      const { explanation } = await academyJson(
        await trainer.exercises[":exerciseId"].attempts[
          ":attemptId"
        ].explanation.$post({
          param: {
            attemptId: encodeURIComponent(attemptId),
            exerciseId: encodeURIComponent(exerciseId),
          },
        }),
        decodeAttemptExplanation
      );
      return explanation;
    },

    async generateExercises(request) {
      const { exercises } = await academyJson(
        await trainer.exercises.$post({ json: request }),
        decodePendingExercises
      );
      return exercises;
    },

    async getAcademyDashboard() {
      return academyJson(
        await api.academy.dashboard.$get(),
        decodeAcademyDashboard
      );
    },

    async getDailyChallenge() {
      return academyJson(
        await api["daily-challenge"].$get(),
        decodeDailyChallenge
      );
    },

    async getMistakeNotebook() {
      return academyJson(await api.mistakes.$get(), decodeMistakeNotebook);
    },

    async getSampleLimits() {
      return academyJson(await api["sample-limits"].$get(), decodeSampleLimits);
    },

    async listPendingExercises() {
      const { exercises } = await academyJson(
        await api.exercises.$get(),
        decodePendingExercises
      );
      return exercises;
    },

    async listVocabulary() {
      const { items } = await academyJson(
        await api.vocabulary.$get(),
        decodeVocabularyList
      );
      return items;
    },

    async startInterview() {
      return academyJson(
        await trainer.interview.$post(),
        decodeStartedInterview
      );
    },

    async submitAttempt(exerciseId, answer) {
      return academyJson(
        // The route reads its body itself, so the typed client takes no JSON for it.
        await api.exercises[":exerciseId"].attempts.$post(
          { param: { exerciseId: encodeURIComponent(exerciseId) } },
          {
            init: {
              body: JSON.stringify({ answer }),
              headers: { "content-type": "application/json" },
            },
          }
        ),
        decodeGradedAttempt
      );
    },

    async testAIKey() {
      const { status } = await academyJson(
        await trainer["ai-key"].test.$post(),
        decodeKeyTest
      );
      return status;
    },

    async writePractice(writingSample) {
      return academyJson(
        await trainer["practice-writing"].$post({ json: { writingSample } }),
        decodePracticeWriting
      );
    },
  };
};
