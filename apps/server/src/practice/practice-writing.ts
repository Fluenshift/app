// Practice writing: a Writing Sample the Academy asked for, evaluated by the Judge like any other
// (docs/adr/0010), whose Findings the Trainer then folds into the Learner's Mistake Patterns. It
// sits outside the Academy, which reads Evaluations and never writes them.
import { Effect, Schema } from "effect";

import type { AnswerTurnInput } from "../academy/interview-service";

// The Judge's Evaluation stands, but the Trainer's Enrichment failed for a reason the Learner
// cannot act on: Grifando's FAILED writing session (docs/adr/0024).
export class EnrichmentFailedError extends Schema.TaggedError<
  EnrichmentFailedError,
  { readonly brand: unique symbol }
>()("EnrichmentFailedError", { evaluationId: Schema.String }) {}

export const answerInterviewTurnFor = (
  _headers: Headers,
  _input: AnswerTurnInput
) => Effect.die(new Error("Not ported yet"));
