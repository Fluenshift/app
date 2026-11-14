import type { EvaluationClient } from "./features/evaluations/evaluation-client";
import {
  PLACEHOLDER_EVALUATION,
  PLACEHOLDER_EVIDENCE,
  PLACEHOLDER_SETUP,
  PLACEHOLDER_SUBMISSION,
  PLACEHOLDER_SUMMARY,
} from "./features/evaluations/stub-values";

interface HttpEvaluationClientOptions {
  readonly fetch?: typeof globalThis.fetch;
}

/** The only module that talks to the server. */
export const createHttpEvaluationClient = (
  _options: HttpEvaluationClientOptions = {}
): EvaluationClient => ({
  deleteEvaluation: () => Promise.reject(new Error("not ported yet")),
  evaluateWriting: () => Promise.resolve(PLACEHOLDER_SUBMISSION),
  getEvaluation: () => Promise.resolve(PLACEHOLDER_EVALUATION),
  getProgressEvidence: () => Promise.resolve(PLACEHOLDER_EVIDENCE),
  getProgressSummary: () => Promise.resolve(PLACEHOLDER_SUMMARY),
  getSetupStatus: () => Promise.resolve(PLACEHOLDER_SETUP),
  listEvaluations: () => Promise.resolve([]),
});
