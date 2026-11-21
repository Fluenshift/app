// A work Evaluation's Enrichment (docs/adr/0041): once the Learner has practiced, the Writing Desk
// folds each Evaluation the Judge stored into the Learner's Mistake Patterns, as practice writing
// does, so a Finding in real text costs mastery (docs/adr/0014). It sits beside practice writing,
// outside the Academy, which reads Evaluations and never writes them.
import type { Cause } from "effect";
import { Effect } from "effect";

import { foldEvaluation } from "../academy/pattern-folding";
import { resolveTrainerCredentials } from "../academy/trainer/credentials";
import { TrainerClient } from "../academy/trainer/trainer-client";
import { nameOf } from "../edge";
import { evaluateWritingForEndpoint } from "../evaluation/evaluation-endpoint";
import { hasEvaluations } from "../history/learning-history";

// A failed fold keeps the Evaluation and its answer, and logs one line by the error's tag or
// name, never its message or the text (docs/adr/0026).
const logFailure = Effect.fn("WorkEnrichment.logFailure")(function* (
  cause: Cause.Cause<unknown>
) {
  yield* Effect.logError("work-enrichment").pipe(
    Effect.annotateLogs({ error: nameOf(cause) })
  );
});

// The Academy is in use once the Learner has a practice-origin Evaluation. The fold runs on the
// Trainer of the request: the key it carries, else the local profile's configured key; with
// none, the Evaluation is not enriched.
const foldWorkEvaluation = Effect.fn("WorkEnrichment.foldWorkEvaluation")(
  function* (headers: Headers, evaluationId: string) {
    const practiced = yield* hasEvaluations("practice");
    if (!practiced) {
      return;
    }
    const credentials = yield* resolveTrainerCredentials(headers);
    if (credentials === null) {
      return;
    }
    const client = yield* TrainerClient;
    yield* foldEvaluation(client.trainerFor(credentials), { evaluationId });
  }
);

// The Writing Desk's Evaluation of a work Writing Sample, folded into the Academy once it is in
// use, after the Evaluation is stored and before the Writing Desk answers, which never changes.
export const evaluateWorkFor = Effect.fn("WorkEnrichment.evaluateWorkFor")(
  function* (headers: Headers, writingSample: string) {
    const result = yield* evaluateWritingForEndpoint(writingSample, new Date());
    if (result.kind === "created") {
      yield* foldWorkEvaluation(headers, result.evaluation.id).pipe(
        Effect.tapCause(logFailure),
        Effect.ignore,
        Effect.catchDefect(() => Effect.void)
      );
    }
    return result;
  }
);
