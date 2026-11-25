// The Evaluation client the screens use. The app runs on the HTTP client of `src/api.ts`, the
// screen tests on the in-memory client; they never coexist (docs/adr/0001). Ported from PE
// apps/web/src/features/evaluations/evaluation-client.ts (5e831bb); the types are the Evaluation
// contract's (docs/adr/0007).
import type {
  Evaluation,
  EvaluationSubmissionResult,
  EvaluationSummary,
  ProgressEvidence,
  ProgressEvidenceSelection,
  ProgressPeriod,
  ProgressSummary,
  SetupStatus,
} from "@grifando/contract";

export interface EvaluationClient {
  readonly deleteEvaluation: (evaluationId: string) => Promise<void>;
  readonly evaluateWriting: (
    writingSample: string
  ) => Promise<EvaluationSubmissionResult>;
  readonly getEvaluation: (evaluationId: string) => Promise<Evaluation | null>;
  readonly getProgressEvidence: (options: {
    readonly period: ProgressPeriod;
    readonly selection: ProgressEvidenceSelection;
  }) => Promise<ProgressEvidence>;
  readonly getProgressSummary: (options: {
    readonly period: ProgressPeriod;
  }) => Promise<ProgressSummary>;
  readonly getSetupStatus: () => Promise<SetupStatus>;
  readonly listEvaluations: () => Promise<readonly EvaluationSummary[]>;
}

/** What a failed API answer says about itself; the server's message is never kept. */
export interface ApiFailure {
  readonly code?: string;
  readonly retryable?: boolean;
}

/** A failed API operation, safe to show: its code, whether a retry may help, and its status. */
export class EvaluationRequestError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly status: number;

  constructor(response: Pick<Response, "status">, failure?: ApiFailure) {
    super("Evaluation request could not be completed");
    this.name = "EvaluationRequestError";
    this.code = failure?.code ?? "request-failed";
    this.retryable = failure?.retryable ?? response.status >= 500;
    this.status = response.status;
  }
}
