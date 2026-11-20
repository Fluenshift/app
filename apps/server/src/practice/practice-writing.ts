// Practice writing: a Writing Sample the Academy asked for, evaluated by the Judge like any other
// (docs/adr/0010), whose Findings the Trainer then folds into the Learner's Mistake Patterns. It
// sits outside the Academy, which reads Evaluations and never writes them.
import type { AIResponseValidationError } from "@fluenshift/contract";
import { Effect, Schema } from "effect";

import { trainerForRequest } from "../academy/academy-requests";
import { answerTurn } from "../academy/interview-service";
import type { AnswerTurnInput } from "../academy/interview-service";
import { foldEvaluation } from "../academy/pattern-folding";
import type { TrainerMethods } from "../academy/trainer/trainer-model";
import { evaluateWriting } from "../evaluation/writing-evaluation";

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
export const evaluatePractice = Effect.fn("PracticeWriting.evaluatePractice")(
  function* (trainer: TrainerMethods, writingSample: string) {
    const evaluation = yield* evaluateWriting(
      writingSample,
      new Date(),
      undefined,
      "practice"
    );
    const failed = new EnrichmentFailedError({ evaluationId: evaluation.id });
    yield* foldEvaluation(trainer, { evaluationId: evaluation.id }).pipe(
      Effect.catchIf(isRefusedAnswer, () => Effect.fail(failed)),
      Effect.catchDefect(() => Effect.fail(failed))
    );
    return evaluation;
  }
);

// One answer to the Learner's interview turn, on the key the request carries. The key is
// resolved before the session is read, as in Grifando.
export const answerInterviewTurnFor = Effect.fn(
  "PracticeWriting.answerInterviewTurnFor"
)(function* (headers: Headers, input: AnswerTurnInput) {
  const trainer = yield* trainerForRequest(headers);
  return yield* answerTurn(
    (answer: string) => evaluatePractice(trainer, answer),
    trainer,
    input
  );
});
