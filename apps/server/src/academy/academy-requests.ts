// The Academy's work for one request: the Trainer on the Learner's key, and what the Academy's
// routes ask of it.
import type { ExerciseGenerationRequest } from "@grifando/contract";
import { Effect } from "effect";

import { explainAttempt, generatePracticeSet } from "./exercise-service";
import { startInterview } from "./interview-service";
import { resolveTrainerCredentials } from "./trainer/credentials";
import { TrainerClient } from "./trainer/trainer-client";
import { TrainerKeyRequiredError } from "./trainer/trainer-errors";

// A Trainer on the key the request carries or, in the local profile, the configured key; no key
// fails, so that the Learner is asked to set one up (Grifando's AI_KEY_REQUIRED).
export const trainerForRequest = Effect.fn("AcademyRequests.trainerForRequest")(
  function* (headers: Headers) {
    const credentials = yield* resolveTrainerCredentials(headers);
    if (credentials === null) {
      return yield* new TrainerKeyRequiredError();
    }
    const client = yield* TrainerClient;
    return client.trainerFor(credentials);
  }
);

// A practice set from the Learner's patterns: the daily session's when the request names the
// Evaluation it follows.
export const generateExercisesFor = Effect.fn(
  "AcademyRequests.generateExercisesFor"
)(function* (headers: Headers, request: ExerciseGenerationRequest) {
  const trainer = yield* trainerForRequest(headers);
  return yield* generatePracticeSet(
    trainer,
    undefined,
    request.afterEvaluationId === undefined
      ? {}
      : { afterEvaluationId: request.afterEvaluationId }
  );
});

// "Explain my answer" on the Learner's key, or null when the Learner has no such Attempt. The key
// is resolved before the Attempt is read, so a missing key answers first, as in Grifando.
export const explainAttemptFor = Effect.fn("AcademyRequests.explainAttemptFor")(
  function* (
    headers: Headers,
    input: { readonly attemptId: string; readonly exerciseId: string }
  ) {
    const trainer = yield* trainerForRequest(headers);
    return yield* explainAttempt(trainer, input);
  }
);

// A new interview on the Learner's key, with its opening question. The key is resolved before the
// session is created, as in Grifando.
export const startInterviewFor = Effect.fn("AcademyRequests.startInterviewFor")(
  function* (headers: Headers) {
    const trainer = yield* trainerForRequest(headers);
    return yield* startInterview(trainer);
  }
);
