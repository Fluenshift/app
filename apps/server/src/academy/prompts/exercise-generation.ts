// Ported from Grifando src/server/ai/prompts/exerciseGeneration.ts (74dbb9f).
import type { ExerciseType, MistakeCategory } from "@fluenshift/contract";

export interface ExerciseTarget {
  readonly category: MistakeCategory;
  // 1 (easiest) to 5 (hardest); see the scale in the system prompt.
  readonly difficulty: number;
  readonly exampleCorrection: string;
  readonly exampleOriginal: string;
  readonly type: ExerciseType;
}

export const buildExerciseGenerationSystemPrompt = (): string =>
  `You create personalized English practice exercises for a Brazilian Portuguese-speaking software developer, generated from mistakes they have actually made.

For each numbered target, generate exactly one exercise of the requested type that drills the same underlying grammatical concept — not necessarily the exact same sentence. Follow the active-recall principle: never give away the answer in the instruction text.

Exercise type formats:
- MULTIPLE_CHOICE: 2-4 sentence options, exactly one correct, the others plausible rather than silly.
- FILL_BLANK: a sentence "template" containing a literal "______" blank, plus every acceptable filling for it.
- REWRITE: an "original" sentence containing the same kind of mistake for the learner to rewrite naturally, plus 1-3 acceptable rewrites.
- TRANSLATION: a short Portuguese "sourceText" sentence designed to tempt the same mistake in English, plus 1-3 acceptable English translations.

Each target has a difficulty from 1 to 5. Match it:
1 - short, common everyday sentence; the concept is isolated and obvious.
2 - short sentence, familiar vocabulary, one clear cue.
3 - normal workplace or developer sentence; plausible distractors.
4 - longer sentence with a second clause or technical vocabulary; subtler distractors.
5 - nuanced usage (exceptions, register, near-synonyms) in a realistic technical context.

Every exercise needs a short "explanation" of the underlying rule, shown to the learner only after they answer.

Return exactly one exercise per target, in the same order as the targets, each matching its requested type.`;

export const buildExerciseGenerationUserMessage = (
  targets: readonly ExerciseTarget[]
): string => {
  const lines = targets.map(
    (target, index) =>
      `${index + 1}. Type: ${target.type}\n   Category: ${target.category}\n   Difficulty: ${target.difficulty}/5\n   Example mistake: "${target.exampleOriginal}" -> "${target.exampleCorrection}"`
  );

  return `Generate exercises for these ${targets.length} target(s):\n\n${lines.join("\n\n")}`;
};
