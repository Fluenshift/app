// Practice writing: a Writing Sample the Academy asked for, evaluated by the Judge like any other
// (docs/adr/0010), whose Findings the Trainer then folds into the Learner's Mistake Patterns. It
// sits outside the Academy, which reads Evaluations and never writes them.
import type {
  AIResponseValidationError,
  PracticeOccurrence,
} from "@grifando/contract";
import { ServerConfig } from "@grifando/env";
import { Effect, Option, Schema } from "effect";

import { trainerForRequest } from "../academy/academy-requests";
import { getNaturalVersion } from "../academy/enrichment-repository";
import { answerTurn } from "../academy/interview-service";
import type {
  AnswerTurnInput,
  AnswerTurnResult,
} from "../academy/interview-service";
import { listOccurrencesForEvaluation } from "../academy/occurrence-repository";
import { foldEvaluation } from "../academy/pattern-folding";
import type { TrainerMethods } from "../academy/trainer/trainer-model";
import {
  evaluateWriting,
  InvalidWritingSampleError,
} from "../evaluation/writing-evaluation";
import type { Evaluation } from "../history/learning-history";

// The Judge's Evaluation stands, but the Trainer's Enrichment failed for a reason the Learner
// cannot act on: Grifando's FAILED writing session (docs/adr/0024).
export class EnrichmentFailedError extends Schema.TaggedError<
  EnrichmentFailedError,
  { readonly brand: unique symbol }
>()("EnrichmentFailedError", { evaluationId: Schema.String }) {}

const isRefusedAnswer = (error: {
  readonly _tag: string;
}): error is AIResponseValidationError =>
  error._tag === "AIResponseValidationError";

// The Judge evaluates the Writing Sample as practice, then the Trainer folds its Findings. An
// access error of the Trainer stays itself, for the Learner to act on; any other failure of the
// Enrichment keeps the Evaluation and names it, as Grifando kept a FAILED writing session.
// Explain code's snippet reaches the Trainer alone, within the Deploy Profile's code cap, which
// the service checks behind the route (HR-02, docs/adr/0038); it is never stored.
export const evaluatePractice = Effect.fn("PracticeWriting.evaluatePractice")(
  function* (
    trainer: TrainerMethods,
    writingSample: string,
    codeSnippet?: string
  ) {
    const { limits } = yield* ServerConfig;
    const overCap = limits.codeMaxCharacters.pipe(
      Option.filter((maximum) => (codeSnippet?.length ?? 0) > maximum)
    );
    if (Option.isSome(overCap)) {
      return yield* new InvalidWritingSampleError({
        reason: `Code snippet exceeds ${overCap.value} characters`,
      });
    }
    const evaluation = yield* evaluateWriting(
      writingSample,
      new Date(),
      undefined,
      "practice"
    );
    const failed = new EnrichmentFailedError({ evaluationId: evaluation.id });
    yield* foldEvaluation(trainer, {
      evaluationId: evaluation.id,
      ...(codeSnippet === undefined ? {} : { codeSnippet }),
    }).pipe(
      Effect.catchIf(isRefusedAnswer, () => Effect.fail(failed)),
      Effect.catchDefect(() => Effect.fail(failed))
    );
    return evaluation;
  }
);

/** An answered interview turn, with the natural version of its answer (docs/adr/0028). */
export type InterviewAnswer = AnswerTurnResult<Evaluation> & {
  readonly naturalVersion: string | null;
};

// One answer to the Learner's interview turn, on the key the request carries. The key is
// resolved before the session is read, as in Grifando.
export const answerInterviewTurnFor = Effect.fn(
  "PracticeWriting.answerInterviewTurnFor"
)(function* (headers: Headers, input: AnswerTurnInput) {
  const trainer = yield* trainerForRequest(headers);
  const answered = yield* answerTurn(
    (answer: string) => evaluatePractice(trainer, answer),
    trainer,
    input
  );
  const withNaturalVersion: InterviewAnswer = {
    ...answered,
    naturalVersion: yield* getNaturalVersion(answered.evaluation.id),
  };
  return withNaturalVersion;
});

/**
 * A practice Writing Sample's Evaluation, its natural version and the Occurrences its Enrichment
 * recorded.
 */
export interface PracticeWriting {
  readonly evaluation: Evaluation;
  readonly naturalVersion: string | null;
  readonly occurrences: readonly PracticeOccurrence[];
}

// Practice writing on the key the request carries (docs/adr/0026): the key is resolved before
// the Judge runs, as Grifando resolved it before its analysis. Explain code adds its snippet
// (docs/adr/0038).
export const practiceWritingFor = Effect.fn(
  "PracticeWriting.practiceWritingFor"
)(function* (headers: Headers, writingSample: string, codeSnippet?: string) {
  const trainer = yield* trainerForRequest(headers);
  const evaluation = yield* evaluatePractice(
    trainer,
    writingSample,
    codeSnippet
  );
  const occurrences = yield* listOccurrencesForEvaluation(evaluation.id);
  return {
    evaluation,
    naturalVersion: yield* getNaturalVersion(evaluation.id),
    occurrences,
  } satisfies PracticeWriting;
});
