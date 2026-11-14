import { ExerciseType, MasteryLevel } from "@fluenshift/contract";
import { describe, expect, it } from "vitest";

import { assignExerciseType, assignExerciseTypeFor } from "./exercise-type";

describe("assignExerciseType", () => {
  it("cycles through all four types in order", () => {
    expect([0, 1, 2, 3].map(assignExerciseType)).toEqual([
      ExerciseType.MULTIPLE_CHOICE,
      ExerciseType.FILL_BLANK,
      ExerciseType.REWRITE,
      ExerciseType.TRANSLATION,
    ]);
  });

  it("wraps around after the fourth index", () => {
    expect(assignExerciseType(4)).toBe(ExerciseType.MULTIPLE_CHOICE);
    expect(assignExerciseType(5)).toBe(ExerciseType.FILL_BLANK);
  });
});

describe("assignExerciseTypeFor", () => {
  it("gives a pattern one step from MASTERED an unscaffolded mastery check", () => {
    const almostMastered = {
      masteryLevel: MasteryLevel.IMPROVING,
      consecutiveCorrectCount: 1,
    };
    expect(assignExerciseTypeFor(almostMastered, 0)).toBe(ExerciseType.REWRITE);
    expect(assignExerciseTypeFor(almostMastered, 1)).toBe(
      ExerciseType.TRANSLATION
    );
  });

  it("follows the normal rotation otherwise", () => {
    const active = {
      masteryLevel: MasteryLevel.ACTIVE,
      consecutiveCorrectCount: 0,
    };
    expect(assignExerciseTypeFor(active, 0)).toBe(assignExerciseType(0));
    expect(assignExerciseTypeFor(active, 1)).toBe(assignExerciseType(1));
  });
});
