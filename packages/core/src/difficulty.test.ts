import { describe, expect, it } from "vitest";

import {
  DEFAULT_ABILITY,
  expectedSuccess,
  levelToRating,
  MAX_LEVEL,
  MIN_LEVEL,
  targetLevel,
  updateAbility,
} from "./difficulty";

describe("expectedSuccess", () => {
  it("is 50% when ability matches difficulty and rises as ability exceeds it", () => {
    expect(expectedSuccess(1000, 1000)).toBeCloseTo(0.5);
    expect(expectedSuccess(1200, 1000)).toBeGreaterThan(0.7);
    expect(expectedSuccess(800, 1000)).toBeLessThan(0.3);
  });
});

describe("updateAbility", () => {
  it("rises on success and falls on failure", () => {
    expect(updateAbility(DEFAULT_ABILITY, 3, true)).toBeGreaterThan(
      DEFAULT_ABILITY
    );
    expect(updateAbility(DEFAULT_ABILITY, 3, false)).toBeLessThan(
      DEFAULT_ABILITY
    );
  });

  it("moves more on a surprising result than on an expected one", () => {
    const passHard =
      updateAbility(DEFAULT_ABILITY, MAX_LEVEL, true) - DEFAULT_ABILITY;
    const passEasy =
      updateAbility(DEFAULT_ABILITY, MIN_LEVEL, true) - DEFAULT_ABILITY;
    expect(passHard).toBeGreaterThan(passEasy);

    const failEasy =
      DEFAULT_ABILITY - updateAbility(DEFAULT_ABILITY, MIN_LEVEL, false);
    const failHard =
      DEFAULT_ABILITY - updateAbility(DEFAULT_ABILITY, MAX_LEVEL, false);
    expect(failEasy).toBeGreaterThan(failHard);
  });
});

describe("targetLevel", () => {
  it("aims at about 70% expected success", () => {
    for (const ability of [900, 1000, 1100]) {
      const level = targetLevel(ability);
      expect(expectedSuccess(ability, levelToRating(level))).toBeGreaterThan(
        0.55
      );
      expect(expectedSuccess(ability, levelToRating(level))).toBeLessThan(0.85);
    }
  });

  it("gets harder as ability grows and stays within 1-5", () => {
    expect(targetLevel(1300)).toBeGreaterThan(targetLevel(1000));
    expect(targetLevel(100)).toBe(MIN_LEVEL);
    expect(targetLevel(5000)).toBe(MAX_LEVEL);
  });
});

describe("difficulty scale", () => {
  it("starts every ability at 1000", () => {
    expect(DEFAULT_ABILITY).toBe(1000);
  });

  it("rates level 1 at 800 and each further level 100 higher", () => {
    expect([1, 2, 3, 4, 5].map(levelToRating)).toEqual([
      800, 900, 1000, 1100, 1200,
    ]);
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
    const abilities = [
      800, 850, 900, 950, 1000, 1050, 1100, 1150, 1200, 1250, 1300, 1350,
    ];
    expect(abilities.map(targetLevel)).toEqual([
      1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5,
    ]);
  });
});
