// Typed stub for the red commit of #10: the ported tests compile and fail on their checks.
import { Effect, Schema } from "effect";

export const RUBRIC_VERSION = "1";

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

export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];
export type FindingSeverity = "Minor" | "Moderate" | "Major";
export type ProficiencyBand =
  | "Needs revision"
  | "Understandable"
  | "Clear"
  | "Natural";

export interface LocatedCorrection {
  readonly byteEnd: number;
  readonly byteStart: number;
  readonly correction: string;
  readonly originalText: string;
}

export class UnsafeCorrectionError extends Schema.TaggedError<UnsafeCorrectionError>()(
  "UnsafeCorrectionError",
  { reason: Schema.String }
) {}

export const countEnglishWords = (_text: string): number => -1;

export const scoreEvaluation = (
  _evaluatedEnglishWordCount: number,
  _severities: readonly FindingSeverity[]
): number => -1;

export const proficiencyBandForScore = (_score: number): ProficiencyBand =>
  "" as ProficiencyBand;

export const applyCorrections = (
  _original: string,
  _corrections: readonly LocatedCorrection[]
): Effect.Effect<string, UnsafeCorrectionError> => Effect.succeed("");
