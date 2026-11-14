// The structured assessment the Judge must return under Rubric Version 1, ported from PE
// apps/server/src/evaluation/evaluation-model.ts. Only the pure contract lives here: the
// EvaluationModel service, its errors and its fake belong to the Judge (Phase 4c).
import { Schema } from "effect";

import { ERROR_CATEGORIES } from "./rubric-v1";
import type { ErrorCategory, FindingSeverity } from "./rubric-v1";

export interface AssessmentSpan {
  readonly byteEnd: number;
  readonly byteStart: number;
  readonly originalText: string;
}

export interface AssessmentFinding extends AssessmentSpan {
  readonly category: ErrorCategory;
  readonly correction: string;
  readonly explanation: string;
  readonly severity: FindingSeverity;
}

export interface AssessmentSuggestion extends AssessmentSpan {
  readonly alternative?: string;
  readonly explanation: string;
}

export interface ModelAssessment {
  readonly findings: readonly AssessmentFinding[];
  readonly nonEnglishSpans: readonly AssessmentSpan[];
  readonly suggestions: readonly AssessmentSuggestion[];
  readonly summary: string;
}

const spanFields = {
  byteEnd: Schema.Natural,
  byteStart: Schema.Natural,
  originalText: Schema.NonEmptyString,
};

export const MeaningfulTextSchema = Schema.String.check(
  Schema.isPattern(/\S/u, {
    expected: "a string containing non-whitespace text",
  })
);

export const ModelAssessmentSchema = Schema.Struct({
  findings: Schema.Array(
    Schema.Struct({
      ...spanFields,
      category: Schema.Literals(ERROR_CATEGORIES),
      correction: Schema.String,
      explanation: MeaningfulTextSchema,
      severity: Schema.Literals(["Minor", "Moderate", "Major"]),
    })
  ),
  nonEnglishSpans: Schema.Array(Schema.Struct(spanFields)),
  suggestions: Schema.Array(
    Schema.Struct({
      ...spanFields,
      alternative: Schema.optionalKey(Schema.String),
      explanation: MeaningfulTextSchema,
    })
  ),
  summary: MeaningfulTextSchema,
});

export class InvalidAssessmentError extends Schema.TaggedError<
  InvalidAssessmentError,
  { readonly brand: unique symbol }
>()("InvalidAssessmentError", { reason: Schema.String }) {}
