// Writing Evaluation: one Writing Sample and the Judge's structured assessment become one stored
// Evaluation, or a typed refusal that stores nothing. Ported from PE
// apps/server/src/evaluation/writing-evaluation.ts (5e831bb). The input caps come from the deploy
// profile (docs/adr/0006); the Evaluation is stored for the Learner of the request, with the
// origin of its Writing Sample: work unless the Academy asked for it (docs/adr/0010).
import { createHash, randomUUID } from "node:crypto";

import type { WritingSampleOrigin } from "@grifando/contract";
import {
  InvalidAssessmentError,
  ModelAssessmentSchema,
} from "@grifando/core/model-assessment";
import type { AssessmentSpan } from "@grifando/core/model-assessment";
import { findProtectedTechnicalContent } from "@grifando/core/protected-content";
import {
  applyCorrections,
  countEnglishWords,
  proficiencyBandForScore,
  CURRENT_RUBRIC_VERSION,
  scoreEvaluation,
  UnsafeCorrectionError,
} from "@grifando/core/rubric-v1";
import {
  isUtf8ByteBoundary,
  isWellFormedUtf8String,
} from "@grifando/core/utf8";
import { ServerConfig } from "@grifando/env";
import { Effect, Option, Schema } from "effect";

import { persistEvaluation } from "../history/learning-history";
import type { Evaluation } from "../history/learning-history";
import { EvaluationModel } from "./evaluation-model";

export class InvalidWritingSampleError extends Schema.TaggedError<
  InvalidWritingSampleError,
  { readonly brand: unique symbol }
>()("InvalidWritingSampleError", { reason: Schema.String }) {}

export class NoEnglishError extends Schema.TaggedError<
  NoEnglishError,
  { readonly brand: unique symbol }
>()("NoEnglishError", { reason: Schema.String }) {}

export type { Evaluation as StoredEvaluation } from "../history/learning-history";

const overlaps = (left: AssessmentSpan, right: AssessmentSpan) =>
  left.byteStart < right.byteEnd && right.byteStart < left.byteEnd;

const validateSpan = (source: Buffer, span: AssessmentSpan) => {
  const validRange =
    Number.isInteger(span.byteStart) &&
    Number.isInteger(span.byteEnd) &&
    span.byteStart >= 0 &&
    span.byteEnd > span.byteStart &&
    span.byteEnd <= source.byteLength &&
    isUtf8ByteBoundary(source, span.byteStart) &&
    isUtf8ByteBoundary(source, span.byteEnd);

  return (
    validRange &&
    source.subarray(span.byteStart, span.byteEnd).toString("utf-8") ===
      span.originalText
  );
};

const textWithout = (source: Buffer, spans: readonly AssessmentSpan[]) => {
  const retained = Buffer.from(source);
  for (const span of spans) {
    retained.fill(0x20, span.byteStart, span.byteEnd);
  }
  return retained.toString("utf-8");
};

// The caps of the deploy profile: UTF-8 bytes always, characters when hosted.
const capFailure = (
  writingSample: string,
  limits: {
    readonly sampleMaxBytes: number;
    readonly sampleMaxCharacters: Option.Option<number>;
  }
) => {
  if (Buffer.byteLength(writingSample, "utf-8") > limits.sampleMaxBytes) {
    return Option.some(
      `Writing Sample exceeds ${limits.sampleMaxBytes} UTF-8 bytes`
    );
  }
  return limits.sampleMaxCharacters.pipe(
    Option.filter((maximum) => writingSample.length > maximum),
    Option.map((maximum) => `Writing Sample exceeds ${maximum} characters`)
  );
};

export const evaluateWriting = Effect.fn("WritingEvaluation.evaluate")(
  function* (
    writingSample: string,
    submittedAt: Date,
    now: () => Date = () => new Date(),
    origin: WritingSampleOrigin = "work"
  ) {
    if (
      writingSample.trim().length === 0 ||
      !isWellFormedUtf8String(writingSample)
    ) {
      return yield* new InvalidWritingSampleError({
        reason: "Writing Sample must contain meaningful text",
      });
    }
    const { limits } = yield* ServerConfig;
    const overCap = capFailure(writingSample, limits);
    if (Option.isSome(overCap)) {
      return yield* new InvalidWritingSampleError({ reason: overCap.value });
    }

    const model = yield* EvaluationModel;
    const protectedSpans = findProtectedTechnicalContent(writingSample);
    const modelEvaluation = yield* model.evaluate(
      writingSample,
      protectedSpans
    );
    const source = Buffer.from(writingSample, "utf-8");
    const assessment = yield* Schema.decodeUnknownEffect(ModelAssessmentSchema)(
      modelEvaluation.assessment,
      { onExcessProperty: "error" }
    ).pipe(
      Effect.mapError(
        () =>
          new InvalidAssessmentError({
            reason: "Model returned an invalid structured assessment",
          })
      )
    );
    const modelAuthoredText = [
      assessment.summary,
      ...assessment.findings.flatMap((finding) => [
        finding.correction,
        finding.explanation,
      ]),
      ...assessment.suggestions.flatMap((suggestion) => [
        suggestion.explanation,
        ...(suggestion.alternative === undefined
          ? []
          : [suggestion.alternative]),
      ]),
    ];
    if (modelAuthoredText.some((value) => !isWellFormedUtf8String(value))) {
      return yield* new InvalidAssessmentError({
        reason: "Model returned ill-formed Unicode text",
      });
    }
    const allSpans = [
      ...assessment.nonEnglishSpans,
      ...assessment.findings,
      ...assessment.suggestions,
    ];

    if (allSpans.some((span) => !validateSpan(source, span))) {
      return yield* new UnsafeCorrectionError({
        reason: "Assessment span does not match Writing Sample bytes",
      });
    }

    if (
      assessment.findings.some((finding, index) =>
        assessment.findings
          .slice(index + 1)
          .some((other) => overlaps(finding, other))
      ) ||
      assessment.findings.some((finding) =>
        assessment.nonEnglishSpans.some((span) => overlaps(finding, span))
      ) ||
      assessment.findings.some((finding) =>
        protectedSpans.some((span) => overlaps(finding, span))
      ) ||
      assessment.suggestions.some(
        (suggestion) =>
          assessment.findings.some((finding) =>
            overlaps(suggestion, finding)
          ) ||
          assessment.nonEnglishSpans.some((span) =>
            overlaps(suggestion, span)
          ) ||
          protectedSpans.some((span) => overlaps(suggestion, span))
      )
    ) {
      return yield* new UnsafeCorrectionError({
        reason: "Assessment contains overlapping correction spans",
      });
    }

    if (
      assessment.findings.some(
        (finding) => finding.correction === finding.originalText
      )
    ) {
      return yield* new UnsafeCorrectionError({
        reason: "Assessment contains a no-op Correction",
      });
    }

    const evaluatedEnglishWordCount = countEnglishWords(
      textWithout(source, [...assessment.nonEnglishSpans, ...protectedSpans])
    );
    if (evaluatedEnglishWordCount === 0) {
      return yield* new NoEnglishError({
        reason: "Writing Sample contains no meaning-bearing English",
      });
    }

    const orderedFindings = assessment.findings.toSorted(
      (left, right) =>
        left.byteStart - right.byteStart || left.byteEnd - right.byteEnd
    );
    const orderedSuggestions = assessment.suggestions.toSorted(
      (left, right) =>
        left.byteStart - right.byteStart || left.byteEnd - right.byteEnd
    );
    const correctedText = yield* applyCorrections(
      writingSample,
      orderedFindings
    );
    const score = scoreEvaluation(
      evaluatedEnglishWordCount,
      orderedFindings.map((finding) => finding.severity)
    );
    const evaluationTimestamp = now().toISOString();
    const evaluation: Evaluation = {
      band: proficiencyBandForScore(score),
      correctedText,
      evaluatedAt: evaluationTimestamp,
      evaluatedEnglishWordCount,
      findings: orderedFindings,
      id: randomUUID(),
      model: modelEvaluation.model,
      originalText: writingSample,
      provider: modelEvaluation.provider,
      rubricVersion: CURRENT_RUBRIC_VERSION,
      score,
      suggestions: orderedSuggestions,
      summary: assessment.summary,
    };

    yield* persistEvaluation({
      contentHash: createHash("sha256").update(writingSample).digest("hex"),
      evaluation,
      inputTokens: modelEvaluation.inputTokens,
      latencyMilliseconds: modelEvaluation.latencyMilliseconds,
      origin,
      outputTokens: modelEvaluation.outputTokens,
      submittedAt: submittedAt.toISOString(),
    });

    return evaluation;
  }
);
