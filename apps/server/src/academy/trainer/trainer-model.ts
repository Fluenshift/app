// What the Academy asks of a Trainer model (docs/adr/0012). Ported from Grifando
// src/server/ai/provider.ts (74dbb9f); Grifando's writing analysis is not a Trainer call
// (docs/adr/0004).
import type { GeneratedExercise } from "@fluenshift/contract";
import type { Effect } from "effect";

import type { ExplainAttemptInput } from "../prompts/answer-explanation";
import type { ExerciseTarget } from "../prompts/exercise-generation";
import type { InterviewHistoryItem } from "../prompts/interview";
import type { TrainerError } from "./trainer-errors";

// Every result names the model that answered, the fallback's when the fallback did (Grifando
// #77).
export interface GeneratedExercises {
  readonly exercises: readonly GeneratedExercise[];
  readonly model: string;
}

export interface InterviewQuestion {
  readonly model: string;
  readonly question: string;
}

export interface AnswerExplanation {
  readonly explanation: string;
  readonly model: string;
}

export interface TrainerMethods {
  readonly continueInterview: (
    history: readonly InterviewHistoryItem[]
  ) => Effect.Effect<InterviewQuestion, TrainerError>;
  readonly explainAttempt: (
    input: ExplainAttemptInput
  ) => Effect.Effect<AnswerExplanation, TrainerError>;
  readonly generateExercises: (
    targets: readonly ExerciseTarget[]
  ) => Effect.Effect<GeneratedExercises, TrainerError>;
}
