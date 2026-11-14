import { describe, expect, it } from "vitest";

import { diffWords, findClosestAnswer } from "./answer-diff";

describe("findClosestAnswer", () => {
  it("picks the acceptable answer closest to what the user wrote", () => {
    const acceptable = [
      "It depends on the configuration.",
      "That depends on how it is configured.",
    ];
    expect(
      findClosestAnswer("That depend on how it is configured", acceptable)
    ).toBe(acceptable[1]);
    expect(
      findClosestAnswer("It depend of the configuration", acceptable)
    ).toBe(acceptable[0]);
  });

  it("keeps the generator's order on ties and handles an empty list", () => {
    expect(findClosestAnswer("x", ["first answer", "second answer"])).toBe(
      "first answer"
    );
    expect(findClosestAnswer("anything", [])).toBeNull();
  });
});

describe("diffWords", () => {
  it("marks swapped words as removed + added and keeps the rest", () => {
    expect(
      diffWords("I depend of this library", "I depend on this library.")
    ).toEqual([
      { kind: "same", text: "I depend" },
      { kind: "removed", text: "of" },
      { kind: "added", text: "on" },
      { kind: "same", text: "this library." },
    ]);
  });

  it("ignores case and punctuation when comparing words", () => {
    expect(diffWords("deploy finished!", "Deploy finished.")).toEqual([
      { kind: "same", text: "Deploy finished." },
    ]);
  });

  it("reports missing and extra words at the edges", () => {
    expect(diffWords("tests pass now", "all tests pass")).toEqual([
      { kind: "added", text: "all" },
      { kind: "same", text: "tests pass" },
      { kind: "removed", text: "now" },
    ]);
  });

  it("handles an empty answer", () => {
    expect(diffWords("", "It works.")).toEqual([
      { kind: "added", text: "It works." },
    ]);
  });
});

describe("diffWords guards", () => {
  it("ignores periods, commas, question and exclamation marks, semicolons, colons and double quotes only", () => {
    expect(diffWords('ok; "yes": done?!, fine.', "OK yes done fine")).toEqual([
      { kind: "same", text: "OK yes done fine" },
    ]);
    expect(diffWords("don't re-run", "dont rerun")).toEqual([
      { kind: "removed", text: "don't re-run" },
      { kind: "added", text: "dont rerun" },
    ]);
  });

  it("splits words on any run of whitespace", () => {
    expect(diffWords("I\tdepend\n on  it", "I depend on it")).toEqual([
      { kind: "same", text: "I depend on it" },
    ]);
  });
});
