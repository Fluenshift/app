// Typed stub for the red commit of #11: the ported tests compile and fail on their checks.
import { Schema, SchemaGetter } from "effect";

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

export const MeaningfulTextSchema = Schema.String;

// Accepts any findings array and decodes it to an empty one, so no check can pass yet.
const StubFindings = Schema.Array(Schema.Unknown).pipe(
  Schema.decodeTo(Schema.Array(Schema.Unknown), {
    decode: SchemaGetter.transform(() => []),
    encode: SchemaGetter.transform((findings) => findings),
  })
);

export const ModelAssessmentSchema = Schema.Struct({
  findings: StubFindings,
  nonEnglishSpans: Schema.Array(Schema.Unknown),
  suggestions: Schema.Array(Schema.Unknown),
  summary: Schema.String,
  hiddenReasoning: Schema.optionalKey(Schema.String),
});

export class InvalidAssessmentError extends Schema.TaggedError<
  InvalidAssessmentError,
  { readonly brand: unique symbol }
>()("InvalidAssessmentError", { reason: Schema.String }) {}
