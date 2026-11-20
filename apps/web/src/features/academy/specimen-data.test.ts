// Ported from Grifando src/components/home/specimenData.test.ts (74dbb9f), under docs/adr/0004:
// a specimen's marks are Findings located by validated byte offsets, so the paragraph must hold
// each span at its offsets, and PE's localization marks them, where Grifando's indexOf
// highlighter searched for the text (#78).
import { describe, expect, it } from "vitest";

import { buildTextSpans } from "../evaluations/spell-checker";
import { SPECIMEN_SCENARIOS, specimenFindings } from "./specimen-data";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

describe("live specimen data", () => {
  it("has three scenarios with unique ids", () => {
    expect(SPECIMEN_SCENARIOS).toHaveLength(3);
    expect(
      new Set(SPECIMEN_SCENARIOS.map((scenario) => scenario.id)).size
    ).toBe(3);
  });

  for (const scenario of SPECIMEN_SCENARIOS) {
    describe(scenario.label, () => {
      it("has three marks", () => {
        expect(scenario.mistakes).toHaveLength(3);
      });

      it("quotes every mistake span verbatim in the paragraph", () => {
        const bytes = encoder.encode(scenario.text);
        for (const mistake of scenario.mistakes) {
          expect(scenario.text).toContain(mistake.originalSpan);
          expect(
            decoder.decode(bytes.subarray(mistake.byteStart, mistake.byteEnd))
          ).toBe(mistake.originalSpan);
        }
      });

      it("lets the highlighter mark every mistake, in order", () => {
        const marked = buildTextSpans(scenario.text, specimenFindings(scenario))
          .toSorted((a, b) => a.start - b.start)
          .map((mark) => mark.id);
        expect(marked).toEqual(
          scenario.mistakes.map((_, index) => `finding-${String(index)}`)
        );
      });
    });
  }
});
