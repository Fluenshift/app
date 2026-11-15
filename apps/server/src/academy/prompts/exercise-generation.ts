import type { ExerciseType, MistakeCategory } from "@fluenshift/contract";

export interface ExerciseTarget {
  readonly category: MistakeCategory;
  readonly difficulty: number;
  readonly exampleCorrection: string;
  readonly exampleOriginal: string;
  readonly type: ExerciseType;
}

export const buildExerciseGenerationUserMessage = (
  _targets: readonly ExerciseTarget[]
): string => "";
