import type { LanguageModel } from "ai";
import { Effect } from "effect";
import type { Schema } from "effect";

import type { TrainerMethods } from "./trainer-model";

const notPorted = () => Effect.die(new Error("not ported yet"));

export const createAiSdkTrainer = (_model: LanguageModel): TrainerMethods => ({
  continueInterview: notPorted,
  explainAttempt: notPorted,
  generateExercises: notPorted,
});

export const toGeminiSchema = (_schema: Schema.Top): unknown => ({
  $schema: "stub",
});
