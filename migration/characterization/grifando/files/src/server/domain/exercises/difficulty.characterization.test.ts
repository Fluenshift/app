// Characterization of src/server/domain/exercises/difficulty.ts at the Grifando baseline:
// the scale constants. The baseline tests compare results with each other, so none of them
// pins the starting ability, the level ratings, the Elo scale, the K-factor or the success
// target.
import { describe, expect, it } from "vitest";

import {
  DEFAULT_ABILITY,
  expectedSuccess,
  levelToRating,
  targetLevel,
  updateAbility,
} from "@/server/domain/exercises/difficulty";

describe("difficulty scale", () => {
  it("starts every ability at 1000", () => {
    expect(DEFAULT_ABILITY).toBe(1000);
  });

  it("rates level 1 at 800 and each further level 100 higher", () => {
    expect([1, 2, 3, 4, 5].map(levelToRating)).toEqual([800, 900, 1000, 1100, 1200]);
  });

  it("gives 10-to-1 odds at a 400-point lead", () => {
    expect(expectedSuccess(1400, 1000)).toBeCloseTo(10 / 11, 12);
    expect(expectedSuccess(1000, 1400)).toBeCloseTo(1 / 11, 12);
  });

  it("moves the ability 16 points on an even-odds result", () => {
    expect(updateAbility(1000, 3, true)).toBe(1016);
    expect(updateAbility(1000, 3, false)).toBe(984);
  });

  it("picks the level nearest the rating with 70% expected success", () => {
    const abilities = [800, 850, 900, 950, 1000, 1050, 1100, 1150, 1200, 1250, 1300, 1350];
    expect(abilities.map(targetLevel)).toEqual([1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });
});
