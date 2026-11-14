// Characterization of src/lib/answerDiff.ts at the Grifando baseline: the baseline tests use
// single spaces and strip only periods and exclamation marks, so none pins the full set of
// ignored punctuation or how words split on other whitespace.
import { describe, expect, it } from "vitest";

import { diffWords } from "@/lib/answerDiff";

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
    expect(diffWords("I\tdepend\n on  it", "I depend on it")).toEqual([{ kind: "same", text: "I depend on it" }]);
  });
});
