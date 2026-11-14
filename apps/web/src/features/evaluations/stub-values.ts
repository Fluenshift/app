// Typed placeholders that the stubs of the Evaluation clients answer with until they are ported.
import type {
  Evaluation,
  EvaluationSubmissionResult,
  ProgressEvidence,
  ProgressSummary,
  SetupStatus,
} from "@fluenshift/contract";

export const PLACEHOLDER_EVALUATION: Evaluation = {
  band: "Natural",
  correctedText: "",
  evaluatedAt: "",
  evaluatedEnglishWordCount: 0,
  findings: [],
  id: "",
  model: "",
  originalText: "",
  provider: "",
  rubricVersion: "",
  score: 0,
  suggestions: [],
  summary: "",
};

export const PLACEHOLDER_SUBMISSION: EvaluationSubmissionResult = {
  evaluation: PLACEHOLDER_EVALUATION,
  kind: "created",
};

export const PLACEHOLDER_SUMMARY: ProgressSummary = {
  averageBand: null,
  averageScore: null,
  categoryDistributions: [],
  categoryRecurrences: [],
  evaluatedEnglishWordCount: 0,
  evaluationCount: 0,
  findingCount: 0,
  findingRate: null,
  incompatibleSegments: [],
  period: "all",
  recurringCorrections: [],
  rubricVersion: "",
};

export const PLACEHOLDER_EVIDENCE: ProgressEvidence = {
  evaluations: [],
  findings: [],
  period: "all",
  rubricVersion: "",
  selection: { kind: "finding-rate" },
};

export const PLACEHOLDER_SETUP: SetupStatus = {
  configured: false,
  dataLocation: "",
  model: "",
  provider: "",
  rubricVersion: "",
};
