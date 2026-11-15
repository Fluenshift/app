// What the Academy asks of a Trainer model (docs/adr/0012). Ported from Grifando
// src/server/ai/provider.ts (74dbb9f); Grifando's writing analysis is not a Trainer call
// (docs/adr/0004).
import type { GeneratedExercise } from "@fluenshift/contract";
import type { Effect } from "effect";

import type { ExplainAttemptInput } from "../prompts/answer-explanation";
import type { ExerciseTarget } from "../prompts/exercise-generation";
import type { InterviewHistoryItem } from "../prompts/interview";
import type { TrainerError } from "./trainer-errors";

export interface InterviewQuestion {
  readonly question: string;
}

export interface AnswerExplanation {
  readonly explanation: string;
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
  ) => Effect.Effect<readonly GeneratedExercise[], TrainerError>;
}
