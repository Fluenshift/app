import type { MasteryLevel, MistakeCategory } from "@fluenshift/contract";
import { Effect } from "effect";

export interface MistakePattern {
  readonly category: MistakeCategory;
  readonly consecutiveCorrectCount: number;
  readonly correctCount: number;
  readonly exampleCorrection: string;
  readonly exampleOriginal: string;
  readonly firstSeenAt: Date;
  readonly id: string;
  readonly incorrectCount: number;
  readonly lastPracticedAt: Date;
  readonly lastSeenAt: Date;
  readonly masteryLevel: MasteryLevel;
  readonly occurrenceCount: number;
  readonly patternKey: string;
}

export interface UpsertPatternInput {
  readonly category: MistakeCategory;
  readonly exampleCorrection: string;
  readonly exampleOriginal: string;
  readonly rawPatternKey: string;
}

const PLACEHOLDER: MistakePattern = {
  category: "ARTICLES",
  consecutiveCorrectCount: 0,
  correctCount: 0,
  exampleCorrection: "",
  exampleOriginal: "",
  firstSeenAt: new Date(0),
  id: "",
  incorrectCount: 0,
  lastPracticedAt: new Date(0),
  lastSeenAt: new Date(1),
  masteryLevel: "MASTERED",
  occurrenceCount: 0,
  patternKey: "",
};

export const upsertPattern = Effect.fn(
  "MistakePatternRepository.upsertPattern"
)(function* (_input: UpsertPatternInput) {
  return yield* Effect.succeed(PLACEHOLDER);
});

export const listPatterns = Effect.fn("MistakePatternRepository.listPatterns")(
  function* () {
    return yield* Effect.succeed<readonly MistakePattern[]>([]);
  }
);
