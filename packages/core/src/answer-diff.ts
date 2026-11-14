// Typed stub for the red commit of #16: the ported tests compile and fail on their checks.
export interface DiffSegment {
  text: string;
  kind: "same" | "removed" | "added";
}

// An empty closest answer and no segments, so no expected answer or diff matches.
export const findClosestAnswer = (
  _userAnswer: string,
  _acceptableAnswers: string[]
): string | null => "";

export const diffWords = (
  _userAnswer: string,
  _expected: string
): DiffSegment[] => [];
