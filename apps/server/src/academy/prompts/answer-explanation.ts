// Ported from Grifando src/server/ai/prompts/answerExplanation.ts (74dbb9f).
import type { GeneratedExercise } from "@fluenshift/contract";

export interface ExplainAttemptInput {
  readonly exercise: GeneratedExercise;
  readonly userAnswer: string;
}

export const buildAnswerExplanationSystemPrompt = (): string =>
  `You are an English writing coach for a Brazilian Portuguese-speaking software developer. The learner just answered a practice exercise and wants to understand the result ("explain my answer").

Explain, in 2 to 5 short sentences:
- what exactly is wrong (or right) in the learner's own answer — point at their words, not at the exercise in general;
- the rule or usage behind it;
- if the learner's answer is a valid alternative the answer key did not list, say so plainly instead of inventing a mistake.

Write in English. A short Portuguese contrast is fine when the mistake comes from Portuguese. Do not repeat the whole correct answer back unless it helps. Call the provided tool with only the explanation.`;

// The option a multiple-choice answer names: its leading decimal integer, read as
// `Number.parseInt(answer, 10)` reads it.
const LEADING_INTEGER = /^\s*[+-]?\d+/u;

const chosenOption = (options: readonly string[], userAnswer: string) => {
  const index = LEADING_INTEGER.exec(userAnswer)?.[0];
  return index === undefined ? undefined : options[Number(index)];
};

const describeExercise = (
  exercise: GeneratedExercise,
  userAnswer: string
): string[] => {
  switch (exercise.type) {
    case "MULTIPLE_CHOICE": {
      const chosen =
        chosenOption(exercise.options, userAnswer) ?? "(no valid option)";
      return [
        `Options: ${exercise.options.map((option, index) => `${index + 1}. ${option}`).join(" | ")}`,
        `Correct option: ${exercise.options[exercise.correctOptionIndex]}`,
        `Learner chose: ${chosen}`,
      ];
    }
    case "FILL_BLANK": {
      return [
        `Sentence: ${exercise.template}`,
        `Accepted answers: ${exercise.acceptableAnswers.join(" | ")}`,
        `Learner answered: ${userAnswer}`,
      ];
    }
    case "REWRITE": {
      return [
        `Sentence to rewrite: ${exercise.original}`,
        `Accepted answers: ${exercise.acceptableAnswers.join(" | ")}`,
        `Learner answered: ${userAnswer}`,
      ];
    }
    case "TRANSLATION": {
      return [
        `Text to translate: ${exercise.sourceText}`,
        `Accepted answers: ${exercise.acceptableAnswers.join(" | ")}`,
        `Learner answered: ${userAnswer}`,
      ];
    }
    default: {
      const unknownExercise: never = exercise;
      return unknownExercise;
    }
  }
};

export const buildAnswerExplanationUserMessage = ({
  exercise,
  userAnswer,
}: ExplainAttemptInput): string =>
  [
    `Exercise type: ${exercise.type}`,
    `Instruction: ${exercise.instruction}`,
    ...describeExercise(exercise, userAnswer),
    `Answer key note: ${exercise.explanation}`,
  ].join("\n");
