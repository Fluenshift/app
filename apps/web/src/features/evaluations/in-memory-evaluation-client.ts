import type { Evaluation, SetupStatus } from "@fluenshift/contract";

import type { EvaluationClient } from "./evaluation-client";
import {
  PLACEHOLDER_EVALUATION,
  PLACEHOLDER_EVIDENCE,
  PLACEHOLDER_SETUP,
  PLACEHOLDER_SUMMARY,
} from "./stub-values";

type ScenarioCorrectedText =
  | { readonly kind: "literal"; readonly value: string }
  | { readonly kind: "submitted-writing" };

interface CreatedEvaluationScenario {
  readonly correctedText: ScenarioCorrectedText;
  readonly detail: Omit<Evaluation, "correctedText" | "id" | "originalText">;
  readonly kind: "created";
}

export type InMemoryEvaluationScenario =
  | CreatedEvaluationScenario
  | { readonly error: Error; readonly kind: "failure" }
  | { readonly kind: "no-english" };

type InMemoryDeletionScenario =
  | { readonly error: Error; readonly kind: "failure" }
  | { readonly kind: "deleted" };

interface InMemoryEvaluationClientOptions {
  readonly attempts?: readonly InMemoryEvaluationScenario[];
  readonly currentRubricVersion?: string;
  readonly deletionAttempts?: readonly InMemoryDeletionScenario[];
  readonly fallback?: CreatedEvaluationScenario;
  readonly now?: () => Date;
  readonly seededEvaluations?: readonly Evaluation[];
  readonly setupStatus?: SetupStatus;
}

export const createInMemoryEvaluationClient = (
  _options: InMemoryEvaluationClientOptions = {}
): EvaluationClient => ({
  deleteEvaluation: () => Promise.reject(new Error("not ported yet")),
  evaluateWriting: () => Promise.resolve({ kind: "no-english" }),
  getEvaluation: () => Promise.resolve(PLACEHOLDER_EVALUATION),
  getProgressEvidence: () => Promise.resolve(PLACEHOLDER_EVIDENCE),
  getProgressSummary: () => Promise.resolve(PLACEHOLDER_SUMMARY),
  getSetupStatus: () => Promise.resolve(PLACEHOLDER_SETUP),
  listEvaluations: () => Promise.resolve([]),
});
