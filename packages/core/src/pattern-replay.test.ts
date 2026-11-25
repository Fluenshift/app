import { ExerciseType, MasteryLevel } from "@grifando/contract";
import { describe, expect, it } from "vitest";

import { applyExerciseResult } from "./mastery";
import type { MasteryState } from "./mastery";
import { replayPattern } from "./pattern-replay";
import type { AttemptEvidence, OccurrenceEvidence } from "./pattern-replay";

const at = (minute: number) => new Date(Date.UTC(2026, 10, 20, 12, minute));

const finding = (
  minute: number,
  originalSpan = "depend of",
  correctedSpan = "depend on"
): OccurrenceEvidence => ({
  at: at(minute),
  correctedSpan,
  isFinding: true,
  originalSpan,
});

const note = (
  minute: number,
  originalSpan = "make a meeting",
  correctedSpan = "hold a meeting"
): OccurrenceEvidence => ({
  at: at(minute),
  correctedSpan,
  isFinding: false,
  originalSpan,
});

const attempt = (
  minute: number,
  isCorrect: boolean,
  exerciseType: ExerciseType = ExerciseType.MULTIPLE_CHOICE
): AttemptEvidence => ({ at: at(minute), exerciseType, isCorrect });

const ACTIVE: MasteryState = {
  consecutiveCorrectCount: 0,
  masteryLevel: MasteryLevel.ACTIVE,
};

describe("replayPattern", () => {
  it("counts the Occurrences and keeps the latest one's spans as the example", () => {
    expect(
      replayPattern(
        [
          finding(1, "depend of", "depend on"),
          note(2, "rely of", "rely on"),
          finding(3, "depends of", "depends on"),
        ],
        []
      )
    ).toMatchObject({
      exampleCorrection: "depends on",
      exampleOriginal: "depends of",
      firstSeenAt: at(1),
      lastSeenAt: at(3),
      occurrenceCount: 3,
    });
  });

  it("counts each Finding's Occurrence and each wrong Attempt as a failed recall, and a note as none", () => {
    const replayed = replayPattern(
      [finding(1), note(2), finding(3)],
      [attempt(4, true), attempt(5, false), attempt(6, true)]
    );

    expect([replayed?.correctCount, replayed?.incorrectCount]).toStrictEqual([
      2, 3,
    ]);
  });

  it("moves the Mastery Level through every recall in the order it happened", () => {
    const occurrences = [finding(1), finding(6)];
    const attempts = [
      attempt(2, true),
      attempt(3, true),
      attempt(4, true),
      attempt(5, true, ExerciseType.REWRITE),
      attempt(7, true),
    ];
    const recalls: readonly [boolean, ExerciseType | undefined][] = [
      [false, undefined],
      [true, ExerciseType.MULTIPLE_CHOICE],
      [true, ExerciseType.MULTIPLE_CHOICE],
      [true, ExerciseType.MULTIPLE_CHOICE],
      [true, ExerciseType.REWRITE],
      [false, undefined],
      [true, ExerciseType.MULTIPLE_CHOICE],
    ];
    let stepByStep = ACTIVE;
    for (const [isCorrect, type] of recalls) {
      stepByStep = applyExerciseResult(stepByStep, isCorrect, type);
    }

    expect(replayPattern(occurrences, attempts)).toMatchObject({
      consecutiveCorrectCount: stepByStep.consecutiveCorrectCount,
      masteryLevel: stepByStep.masteryLevel,
    });
    expect(stepByStep).toStrictEqual({
      consecutiveCorrectCount: 1,
      masteryLevel: MasteryLevel.IMPROVING,
    });
  });

  it("replays a Finding before an Attempt made at the same moment", () => {
    expect(
      replayPattern(
        [finding(1), finding(3)],
        [attempt(2, true), attempt(2, true), attempt(3, true)]
      )
    ).toMatchObject({
      consecutiveCorrectCount: 1,
      masteryLevel: MasteryLevel.ACTIVE,
    });
  });

  it("dates the last recall to the latest Finding or Attempt, and a pattern without one to its first Occurrence", () => {
    expect(
      [
        replayPattern([note(1), finding(2), note(3)], []),
        replayPattern([note(1), finding(2)], [attempt(5, false)]),
        replayPattern([note(1), note(3)], []),
      ].map((replayed) => replayed?.lastPracticedAt)
    ).toStrictEqual([at(2), at(5), at(1)]);
  });

  it("leaves a note's pattern Active with no recall", () => {
    expect(replayPattern([note(1), note(2)], [])).toMatchObject({
      consecutiveCorrectCount: 0,
      correctCount: 0,
      incorrectCount: 0,
      masteryLevel: MasteryLevel.ACTIVE,
    });
  });

  it("answers null when no Occurrence is left, whatever the Attempts", () => {
    expect(replayPattern([], [attempt(1, true)])).toBeNull();
  });
});
