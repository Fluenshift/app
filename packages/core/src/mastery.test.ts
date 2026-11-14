import { ExerciseType, MasteryLevel } from "@fluenshift/contract";
import { describe, expect, it } from "vitest";

import { applyExerciseResult, isFading, needsMasteryCheck } from "./mastery";

describe("applyExerciseResult", () => {
  it("keeps ACTIVE after a single correct attempt", () => {
    const result = applyExerciseResult(
      { masteryLevel: MasteryLevel.ACTIVE, consecutiveCorrectCount: 0 },
      true
    );
    expect(result).toEqual({
      masteryLevel: MasteryLevel.ACTIVE,
      consecutiveCorrectCount: 1,
    });
  });

  it("promotes ACTIVE to IMPROVING after two consecutive correct attempts", () => {
    const result = applyExerciseResult(
      { masteryLevel: MasteryLevel.ACTIVE, consecutiveCorrectCount: 1 },
      true
    );
    expect(result).toEqual({
      masteryLevel: MasteryLevel.IMPROVING,
      consecutiveCorrectCount: 0,
    });
  });

  it("promotes IMPROVING to MASTERED when the second correct answer is unscaffolded", () => {
    for (const type of [ExerciseType.REWRITE, ExerciseType.TRANSLATION]) {
      const result = applyExerciseResult(
        { masteryLevel: MasteryLevel.IMPROVING, consecutiveCorrectCount: 1 },
        true,
        type
      );
      expect(result).toEqual({
        masteryLevel: MasteryLevel.MASTERED,
        consecutiveCorrectCount: 0,
      });
    }
  });

  it("keeps IMPROVING waiting for the mastery check after a scaffolded correct answer", () => {
    for (const type of [
      ExerciseType.MULTIPLE_CHOICE,
      ExerciseType.FILL_BLANK,
      undefined,
    ]) {
      const result = applyExerciseResult(
        { masteryLevel: MasteryLevel.IMPROVING, consecutiveCorrectCount: 1 },
        true,
        type
      );
      expect(result).toEqual({
        masteryLevel: MasteryLevel.IMPROVING,
        consecutiveCorrectCount: 1,
      });
      expect(needsMasteryCheck(result)).toBe(true);
    }
  });

  it("only asks for the mastery check one step from MASTERED", () => {
    expect(
      needsMasteryCheck({
        masteryLevel: MasteryLevel.IMPROVING,
        consecutiveCorrectCount: 0,
      })
    ).toBe(false);
    expect(
      needsMasteryCheck({
        masteryLevel: MasteryLevel.ACTIVE,
        consecutiveCorrectCount: 1,
      })
    ).toBe(false);
  });

  it("drops IMPROVING back to ACTIVE on an incorrect attempt", () => {
    const result = applyExerciseResult(
      { masteryLevel: MasteryLevel.IMPROVING, consecutiveCorrectCount: 1 },
      false
    );
    expect(result).toEqual({
      masteryLevel: MasteryLevel.ACTIVE,
      consecutiveCorrectCount: 0,
    });
  });

  it("resets the streak on an incorrect attempt from ACTIVE", () => {
    const result = applyExerciseResult(
      { masteryLevel: MasteryLevel.ACTIVE, consecutiveCorrectCount: 1 },
      false
    );
    expect(result).toEqual({
      masteryLevel: MasteryLevel.ACTIVE,
      consecutiveCorrectCount: 0,
    });
  });

  it("keeps MASTERED on a correct attempt and drops it to IMPROVING on a failure", () => {
    const correct = applyExerciseResult(
      { masteryLevel: MasteryLevel.MASTERED, consecutiveCorrectCount: 0 },
      true
    );
    const incorrect = applyExerciseResult(
      { masteryLevel: MasteryLevel.MASTERED, consecutiveCorrectCount: 0 },
      false
    );
    expect(correct).toEqual({
      masteryLevel: MasteryLevel.MASTERED,
      consecutiveCorrectCount: 0,
    });
    expect(incorrect).toEqual({
      masteryLevel: MasteryLevel.IMPROVING,
      consecutiveCorrectCount: 0,
    });
  });
});

describe("isFading", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const now = new Date("2026-10-27T12:00:00Z");
  // correctCount 4 + incorrectCount 1 -> half-life ~11.3 days.
  const mastered = {
    masteryLevel: MasteryLevel.MASTERED,
    consecutiveCorrectCount: 0,
    correctCount: 4,
    incorrectCount: 1,
  };

  it("flags a MASTERED pattern once its recall drops below the review threshold", () => {
    expect(
      isFading(
        { ...mastered, lastPracticedAt: new Date(now.getTime() - 5 * DAY) },
        now
      )
    ).toBe(false);
    expect(
      isFading(
        { ...mastered, lastPracticedAt: new Date(now.getTime() - 15 * DAY) },
        now
      )
    ).toBe(true);
  });

  it("never flags patterns that aren't MASTERED", () => {
    const old = new Date(now.getTime() - 100 * DAY);
    expect(
      isFading(
        {
          ...mastered,
          masteryLevel: MasteryLevel.ACTIVE,
          lastPracticedAt: old,
        },
        now
      )
    ).toBe(false);
  });
});

describe("isFading guards", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const now = new Date("2026-10-27T12:00:00Z");

  it("never flags an IMPROVING pattern, however long unpracticed", () => {
    const pattern = {
      masteryLevel: MasteryLevel.IMPROVING,
      consecutiveCorrectCount: 1,
      correctCount: 4,
      incorrectCount: 1,
      lastPracticedAt: new Date(now.getTime() - 100 * DAY),
    };

    expect(isFading(pattern, now)).toBe(false);
  });
});
