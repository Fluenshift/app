// The Evaluation API: what the server answers and the web app reads. Ported from the types of PE
// apps/web/src/features/evaluations/evaluation-client.ts (5e831bb). The closed value sets of
// Rubric Version 1 live here, and packages/core reads them from here.
import { Schema } from "effect";

/** The Error Categories permitted by Rubric Version 1. */
export const ERROR_CATEGORIES = [
  "Spelling",
  "Article",
  "Verb form/tense",
  "Preposition",
  "Word choice",
  "Grammar/syntax",
  "Punctuation/capitalization",
  "Clarity",
  "Other",
] as const;
export const ErrorCategory = Schema.Literals(ERROR_CATEGORIES);
export type ErrorCategory = typeof ErrorCategory.Type;

export const FINDING_SEVERITIES = ["Minor", "Moderate", "Major"] as const;
export const FindingSeverity = Schema.Literals(FINDING_SEVERITIES);
export type FindingSeverity = typeof FindingSeverity.Type;

export const PROFICIENCY_BANDS = [
  "Needs revision",
  "Understandable",
  "Clear",
  "Natural",
] as const;
export const ProficiencyBand = Schema.Literals(PROFICIENCY_BANDS);
export type ProficiencyBand = typeof ProficiencyBand.Type;

/**
 * Where a Writing Sample comes from: the learner's real work, or a practice exercise of the
 * Academy (docs/adr/0010, docs/adr/0014). Practice stays out of Finding Rate by default.
 */
export const WRITING_SAMPLE_ORIGINS = ["work", "practice"] as const;
export const WritingSampleOrigin = Schema.Literals(WRITING_SAMPLE_ORIGINS);
export type WritingSampleOrigin = typeof WritingSampleOrigin.Type;

/** An Overall Score: an integer from 0 to 100. */
const Score = Schema.Int.check(Schema.isBetween({ maximum: 100, minimum: 0 }));

export const EvaluationFinding = Schema.Struct({
  byteEnd: Schema.optionalKey(Schema.Natural),
  byteStart: Schema.optionalKey(Schema.Natural),
  category: ErrorCategory,
  correction: Schema.String,
  explanation: Schema.String,
  originalText: Schema.String,
  severity: FindingSeverity,
});
export type EvaluationFinding = typeof EvaluationFinding.Type;

export const EvaluationSuggestion = Schema.Struct({
  alternative: Schema.optionalKey(Schema.String),
  byteEnd: Schema.optionalKey(Schema.Natural),
  byteStart: Schema.optionalKey(Schema.Natural),
  explanation: Schema.String,
  originalText: Schema.String,
});
export type EvaluationSuggestion = typeof EvaluationSuggestion.Type;

export const Evaluation = Schema.Struct({
  band: ProficiencyBand,
  correctedText: Schema.String,
  evaluatedAt: Schema.String,
  evaluatedEnglishWordCount: Schema.Natural,
  findings: Schema.Array(EvaluationFinding),
  id: Schema.String,
  model: Schema.String,
  originalText: Schema.String,
  provider: Schema.String,
  rubricVersion: Schema.String,
  score: Score,
  suggestions: Schema.Array(EvaluationSuggestion),
  summary: Schema.String,
});
export type Evaluation = typeof Evaluation.Type;

export const EvaluationSubmissionResult = Schema.Union([
  Schema.Struct({ evaluation: Evaluation, kind: Schema.Literal("created") }),
  Schema.Struct({ kind: Schema.Literal("no-english") }),
]);
export type EvaluationSubmissionResult = typeof EvaluationSubmissionResult.Type;

/** One retained Evaluation as History lists it. */
export const EvaluationSummary = Schema.Struct({
  band: ProficiencyBand,
  evaluatedAt: Schema.String,
  id: Schema.String,
  rubricVersion: Schema.String,
  score: Score,
  summary: Schema.String,
});
export type EvaluationSummary = typeof EvaluationSummary.Type;

export const CategoryRecurrence = Schema.Struct({
  category: ErrorCategory,
  evaluationCount: Schema.Natural,
  recurrencePercentage: Schema.Finite,
});
export type CategoryRecurrence = typeof CategoryRecurrence.Type;

export const RecurringCorrection = Schema.Struct({
  correction: Schema.String,
  occurrenceCount: Schema.Natural,
  originalText: Schema.String,
});
export type RecurringCorrection = typeof RecurringCorrection.Type;

export const CategoryDistribution = Schema.Struct({
  category: ErrorCategory,
  findingCount: Schema.Natural,
});
export type CategoryDistribution = typeof CategoryDistribution.Type;

export const PROGRESS_PERIODS = ["7-days", "30-days", "all"] as const;
export const ProgressPeriod = Schema.Literals(PROGRESS_PERIODS);
export type ProgressPeriod = typeof ProgressPeriod.Type;

/**
 * One Rubric Version's evidence. Segments are computed independently so no rate, recurrence,
 * distribution, or average crosses a version boundary.
 */
export const ProgressSegment = Schema.Struct({
  averageBand: Schema.NullOr(ProficiencyBand),
  averageScore: Schema.NullOr(Schema.Finite),
  categoryDistributions: Schema.Array(CategoryDistribution),
  categoryRecurrences: Schema.Array(CategoryRecurrence),
  evaluatedEnglishWordCount: Schema.Natural,
  evaluationCount: Schema.Natural,
  findingCount: Schema.Natural,
  findingRate: Schema.NullOr(Schema.Finite),
  recurringCorrections: Schema.Array(RecurringCorrection),
  rubricVersion: Schema.String,
});
export type ProgressSegment = typeof ProgressSegment.Type;

export const ProgressSummary = Schema.Struct({
  ...ProgressSegment.fields,
  incompatibleSegments: Schema.Array(ProgressSegment),
  period: ProgressPeriod,
});
export type ProgressSummary = typeof ProgressSummary.Type;

export const ProgressEvidenceSelection = Schema.Union([
  Schema.Struct({ category: ErrorCategory, kind: Schema.Literal("category") }),
  Schema.Struct({
    correction: Schema.String,
    kind: Schema.Literal("correction"),
    originalText: Schema.String,
  }),
  Schema.Struct({ kind: Schema.Literal("average-score") }),
  Schema.Struct({ kind: Schema.Literal("finding-rate") }),
]);
export type ProgressEvidenceSelection = typeof ProgressEvidenceSelection.Type;

/**
 * The body of `POST /api/progress/evidence`. A Correction selection carries text the Learner
 * wrote, so the selection travels in the body, never in the URL (docs/adr/0008).
 */
export const ProgressEvidenceRequest = Schema.Struct({
  period: ProgressPeriod,
  selection: ProgressEvidenceSelection,
});
export type ProgressEvidenceRequest = typeof ProgressEvidenceRequest.Type;

/**
 * A retained Finding located by its Evaluation and its position inside that Evaluation,
 * because Findings carry no durable identity yet.
 */
export const ProgressEvidenceFinding = Schema.Struct({
  category: ErrorCategory,
  correction: Schema.String,
  evaluatedAt: Schema.String,
  evaluationId: Schema.String,
  evaluationSummary: Schema.String,
  explanation: Schema.String,
  findingIndex: Schema.Natural,
  originalText: Schema.String,
  severity: FindingSeverity,
});
export type ProgressEvidenceFinding = typeof ProgressEvidenceFinding.Type;

export const ProgressEvidenceEvaluation = Schema.Struct({
  band: ProficiencyBand,
  evaluatedAt: Schema.String,
  evaluatedEnglishWordCount: Schema.Natural,
  findingCount: Schema.Natural,
  id: Schema.String,
  score: Score,
  summary: Schema.String,
});
export type ProgressEvidenceEvaluation = typeof ProgressEvidenceEvaluation.Type;

export const ProgressEvidence = Schema.Struct({
  evaluations: Schema.Array(ProgressEvidenceEvaluation),
  findings: Schema.Array(ProgressEvidenceFinding),
  period: ProgressPeriod,
  rubricVersion: Schema.String,
  selection: ProgressEvidenceSelection,
});
export type ProgressEvidence = typeof ProgressEvidence.Type;

/**
 * The local profile's Trainer as `/setup` shows it: the provider and model of the key the server
 * holds, or that it holds none (docs/adr/0012, #273).
 */
export const TrainerSetup = Schema.Union([
  Schema.Struct({
    configured: Schema.Literal(true),
    model: Schema.String,
    provider: Schema.String,
  }),
  Schema.Struct({ configured: Schema.Literal(false) }),
]);
export type TrainerSetup = typeof TrainerSetup.Type;

export const SetupStatus = Schema.Struct({
  configured: Schema.Boolean,
  dataLocation: Schema.String,
  model: Schema.String,
  provider: Schema.String,
  rubricVersion: Schema.String,
  // The local profile's Trainer; the hosted profile takes the visitor's key instead.
  trainer: Schema.optionalKey(TrainerSetup),
});
export type SetupStatus = typeof SetupStatus.Type;
