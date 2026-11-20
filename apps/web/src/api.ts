// The only module that talks to the server: the HTTP Evaluation client, over Hono's typed client,
// and the HTTP Academy client beside it (docs/adr/0025). The Evaluation client is ported from PE
// apps/web/src/features/evaluations/http-evaluation-client.ts (5e831bb). Every answer is decoded
// with its contract (docs/adr/0007), and a Progress selection travels in a request body, never in
// the URL (docs/adr/0008).
import {
  DailyChallenge,
  Evaluation,
  EvaluationSubmissionResult,
  EvaluationSummary,
  ProgressEvidence,
  ProgressSummary,
  SetupStatus,
  VocabularyList,
} from "@fluenshift/contract";
import { Option, Schema } from "effect";
import { hc } from "hono/client";
import type { AppType } from "server/app";

import type { AcademyClient } from "./features/academy/academy-client";
import { EvaluationRequestError } from "./features/evaluations/evaluation-client";
import type {
  ApiFailure,
  EvaluationClient,
} from "./features/evaluations/evaluation-client";

interface HttpEvaluationClientOptions {
  readonly fetch?: typeof globalThis.fetch;
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
const decodeEvaluation = Schema.decodeUnknownOption(Evaluation);
const decodeSubmission = Schema.decodeUnknownOption(EvaluationSubmissionResult);
const decodeSummaries = Schema.decodeUnknownOption(
  Schema.Array(EvaluationSummary)
);
const decodeProgressSummary = Schema.decodeUnknownOption(ProgressSummary);
const decodeProgressEvidence = Schema.decodeUnknownOption(ProgressEvidence);
const decodeSetupStatus = Schema.decodeUnknownOption(SetupStatus);
const decodeDailyChallenge = Schema.decodeUnknownOption(DailyChallenge);
const decodeVocabularyList = Schema.decodeUnknownOption(VocabularyList);

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

// Hono's client puts a path parameter into the URL as it is, so the identity is encoded here.
const identity = (evaluationId: string) => ({
  param: { evaluationId: encodeURIComponent(evaluationId) },
});

export const createHttpEvaluationClient = ({
  fetch,
}: HttpEvaluationClientOptions = {}): EvaluationClient => {
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
  fetch,
}: HttpEvaluationClientOptions = {}): AcademyClient => {
  const { api } = hc<AppType>("/", fetch === undefined ? {} : { fetch });

  return {
    async createVocabularyItem(request) {
      const response = await api.vocabulary.$post({ json: request });
      if (!response.ok) {
        throw new EvaluationRequestError(
          response,
          failureOf(await parseJson(response))
        );
      }
    },

    // A 404 means the item is already gone, as when another tab removed it.
    async deleteVocabularyItem(itemId) {
      const response = await api.vocabulary[":itemId"].$delete({
        param: { itemId: encodeURIComponent(itemId) },
      });
      if (!response.ok && response.status !== 404) {
        throw new EvaluationRequestError(
          response,
          failureOf(await parseJson(response))
        );
      }
    },

    async getDailyChallenge() {
      return requireJson(
        await api["daily-challenge"].$get(),
        decodeDailyChallenge
      );
    },

    async listVocabulary() {
      const { items } = await requireJson(
        await api.vocabulary.$get(),
        decodeVocabularyList
      );
      return items;
    },
  };
};
