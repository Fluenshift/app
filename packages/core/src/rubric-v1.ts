// Rubric Version 1: word count, score, band and correction application, ported from PE
// apps/server/src/evaluation/rubric-v1.ts. Byte offsets use Uint8Array instead of Buffer.
import { Effect, Schema } from "effect";

import {
  concatBytes,
  decodeUtf8,
  encodeUtf8,
  isUtf8ByteBoundary,
  isWellFormedUtf8String,
} from "./utf8";

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

export class UnsafeCorrectionError extends Schema.TaggedError<
  UnsafeCorrectionError,
  { readonly brand: unique symbol }
>()("UnsafeCorrectionError", { reason: Schema.String }) {}

const SEVERITY_POINTS: Record<FindingSeverity, number> = {
  Major: 12,
  Minor: 3,
  Moderate: 7,
};

const WORD_PATTERN = /\p{L}\p{M}*(?:['’\-‑]\p{L}\p{M}*|\p{L}\p{M}*)*/gu;

export const countEnglishWords = (text: string): number =>
  [...text.matchAll(WORD_PATTERN)].length;

export const scoreEvaluation = (
  evaluatedEnglishWordCount: number,
  severities: readonly FindingSeverity[]
): number => {
  const errorPoints = severities.reduce(
    (total, severity) => total + SEVERITY_POINTS[severity],
    0
  );
  const denominator = Math.max(evaluatedEnglishWordCount, 20);
  return Math.min(
    100,
    Math.max(0, Math.floor(100 - (100 * errorPoints) / denominator + 0.5))
  );
};

export const proficiencyBandForScore = (score: number): ProficiencyBand => {
  if (score >= 85) {
    return "Natural";
  }
  if (score >= 70) {
    return "Clear";
  }
  if (score >= 50) {
    return "Understandable";
  }
  return "Needs revision";
};

export const applyCorrections = (
  original: string,
  corrections: readonly LocatedCorrection[]
): Effect.Effect<string, UnsafeCorrectionError> =>
  Effect.try({
    catch: (cause) =>
      cause instanceof UnsafeCorrectionError
        ? cause
        : new UnsafeCorrectionError({
            reason: "Correction application failed",
          }),
    try: () => {
      const source = encodeUtf8(original);
      const ordered = corrections.toSorted(
        (left, right) => right.byteStart - left.byteStart
      );
      let previousStart = source.byteLength;
      let result = source;

      for (const correction of ordered) {
        const { byteEnd, byteStart, originalText } = correction;
        const invalidRange =
          !Number.isInteger(byteStart) ||
          !Number.isInteger(byteEnd) ||
          byteStart < 0 ||
          byteEnd <= byteStart ||
          byteEnd > source.byteLength ||
          byteEnd > previousStart ||
          !isUtf8ByteBoundary(source, byteStart) ||
          !isUtf8ByteBoundary(source, byteEnd) ||
          !isWellFormedUtf8String(correction.correction);

        if (invalidRange) {
          throw new UnsafeCorrectionError({
            reason: "Correction spans overlap or are outside Writing Sample",
          });
        }

        if (decodeUtf8(source.subarray(byteStart, byteEnd)) !== originalText) {
          throw new UnsafeCorrectionError({
            reason: "Correction source does not match Writing Sample bytes",
          });
        }

        result = concatBytes([
          result.subarray(0, byteStart),
          encodeUtf8(correction.correction),
          result.subarray(byteEnd),
        ]);
        previousStart = byteStart;
      }

      return decodeUtf8(result);
    },
  });
