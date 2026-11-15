import type { GeneratedExercise } from "@fluenshift/contract";

export interface ExplainAttemptInput {
  readonly exercise: GeneratedExercise;
  readonly userAnswer: string;
}

export const buildAnswerExplanationUserMessage = (
  _input: ExplainAttemptInput
): string => "";
