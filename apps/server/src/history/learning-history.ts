// Typed stub for the red commit: nothing is stored and nothing is found.
import type {
  ErrorCategory,
  FindingSeverity,
  ProficiencyBand,
  WritingSampleOrigin,
} from "@fluenshift/contract";
import { Effect } from "effect";

export interface EvaluationFinding {
  readonly byteEnd: number;
  readonly byteStart: number;
  readonly category: ErrorCategory;
  readonly correction: string;
  readonly explanation: string;
  readonly originalText: string;
  readonly severity: FindingSeverity;
}

export interface EvaluationSuggestion {
  readonly alternative?: string;
  readonly byteEnd: number;
  readonly byteStart: number;
  readonly explanation: string;
  readonly originalText: string;
}

export interface Evaluation {
  readonly band: ProficiencyBand;
  readonly correctedText: string;
  readonly evaluatedAt: string;
  readonly evaluatedEnglishWordCount: number;
  readonly findings: readonly EvaluationFinding[];
  readonly id: string;
  readonly model: string;
  readonly originalText: string;
  readonly provider: string;
  readonly rubricVersion: string;
  readonly score: number;
  readonly suggestions: readonly EvaluationSuggestion[];
  readonly summary: string;
}

export type EvaluationSummary = Pick<
  Evaluation,
  "band" | "evaluatedAt" | "id" | "rubricVersion" | "score" | "summary"
>;

export interface PersistEvaluationInput {
  readonly contentHash: string;
  readonly evaluation: Evaluation;
  readonly inputTokens?: number;
  readonly latencyMilliseconds: number;
  readonly origin?: WritingSampleOrigin;
  readonly outputTokens?: number;
  readonly submittedAt: string;
}

export const persistEvaluation = Effect.fn("LearningHistory.persistEvaluation")(
  function* (_input: PersistEvaluationInput) {
    yield* Effect.void;
  }
);

export const listEvaluations = Effect.fn("LearningHistory.listEvaluations")(
  function* () {
    yield* Effect.void;
    const summaries: readonly EvaluationSummary[] = [];
    return summaries;
  }
);

const notFound = (): Evaluation | null => null;

export const getEvaluation = Effect.fn("LearningHistory.getEvaluation")(
  function* (_evaluationId: string) {
    yield* Effect.void;
    return notFound();
  }
);

export const deleteEvaluation = Effect.fn("LearningHistory.deleteEvaluation")(
  function* (_evaluationId: string) {
    yield* Effect.void;
  }
);
