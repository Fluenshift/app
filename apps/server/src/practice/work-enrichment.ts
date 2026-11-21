// A work Evaluation's Enrichment (docs/adr/0041): once the Learner has practiced, the Writing Desk
// folds each Evaluation the Judge stored into the Learner's Mistake Patterns, as practice writing
// does, so a mistake in real text costs mastery (docs/adr/0014). It sits beside practice writing,
// outside the Academy, which reads Evaluations and never writes them.
import { Effect } from "effect";

import { evaluateWritingForEndpoint } from "../evaluation/evaluation-endpoint";

// The Writing Desk's Evaluation of a work Writing Sample, folded into the Academy once it is in
// use, on the Trainer of the request.
export const evaluateWorkFor = Effect.fn("WorkEnrichment.evaluateWorkFor")(
  function* (_headers: Headers, writingSample: string) {
    return yield* evaluateWritingForEndpoint(writingSample, new Date());
  }
);
