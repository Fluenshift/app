// Characterization of apps/server/src/evaluation/assessment-localization.ts at the PE
// baseline: guards of the duplicate coalescing and of the unique re-anchoring that no baseline
// test pins. Each case leaves the model's finding untouched.
import { describe, expect, it } from "bun:test";

import { localizeModelAssessment } from "./assessment-localization";
import type { AssessmentFinding, ModelAssessment } from "./evaluation-model";

const assessmentFor = (
  findings: readonly AssessmentFinding[]
): ModelAssessment => ({
  findings,
  nonEnglishSpans: [],
  suggestions: [],
  summary: "Synthetic localization fixture.",
});

const findingFor = (
  originalText: string,
  correction: string,
  byteStart: number,
  category: AssessmentFinding["category"]
): AssessmentFinding => ({
  byteEnd: byteStart + Buffer.byteLength(originalText, "utf-8"),
  byteStart,
  category,
  correction,
  explanation: "Synthetic correction.",
  originalText,
  severity: "Minor",
});

describe("assessment localization guards", () => {
  it("coalesces an adjacent duplicate only for an Other finding", () => {
    const sample = "The service restarted automatically automatically.";
    const wordChoice = findingFor("automatically", "", 1, "Word choice");

    expect(
      localizeModelAssessment(sample, assessmentFor([wordChoice])).findings
    ).toEqual([wordChoice]);
  });

  it("treats overlapping occurrences of the original text as ambiguous", () => {
    const sample = "Hmmm, the logs stop.";
    const overlapping = findingFor("mm", "m", 0, "Spelling");

    expect(
      localizeModelAssessment(sample, assessmentFor([overlapping])).findings
    ).toEqual([overlapping]);
  });

  it("does not coalesce a word that occurs a third time", () => {
    const sample = "Use foo foo. Keep foo.";
    const duplicate = findingFor("foo", "", 1, "Other");

    expect(
      localizeModelAssessment(sample, assessmentFor([duplicate])).findings
    ).toEqual([duplicate]);
  });
});
