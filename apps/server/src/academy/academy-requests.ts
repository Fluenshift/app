// The Academy's work for one request: the Trainer on the Learner's key, and what the Academy's
// routes ask of it.
import type { ExerciseGenerationRequest } from "@fluenshift/contract";
import { Effect } from "effect";

import type { Exercise } from "./exercise-repository";

export const generateExercisesFor = (
  _headers: Headers,
  _request: ExerciseGenerationRequest
) => Effect.succeed<readonly Exercise[]>([]);
