// Characterization of apps/server/src/evaluation/protected-content.ts at the PE baseline: what
// protected-content.test.ts leaves out. Its JSON sample is also a YAML flow mapping, so none
// of its cases needs the JSON block pass. It compares `originalText` only, so none checks the
// byte offsets that every span carries.
import { describe, expect, it } from "bun:test";

import { findProtectedTechnicalContent } from "./protected-content";

const protectedText = (sample: string) =>
  findProtectedTechnicalContent(sample).map((span) => span.originalText);

describe("Protected Technical Content guards", () => {
  it("protects lines of JSON that are not YAML", () => {
    expect(protectedText("Use this list:\n[1]\nthen stop.")).toEqual(["[1]"]);
    expect(protectedText("[true]\n  [null]")).toEqual(["[true]", "  [null]"]);
    expect(protectedText("The answer [1] is wrong.")).toEqual([]);
  });

  it("measures each span in UTF-8 bytes of the whole Writing Sample", () => {
    expect(
      findProtectedTechnicalContent("Olá — rode `npm test` agora.")
    ).toEqual([{ byteEnd: 24, byteStart: 14, originalText: "`npm test`" }]);
    expect(findProtectedTechnicalContent("🚀 rode `npm test`")).toEqual([
      { byteEnd: 20, byteStart: 10, originalText: "`npm test`" },
    ]);
    expect(findProtectedTechnicalContent("日本 src/app.ts")).toEqual([
      { byteEnd: 17, byteStart: 7, originalText: "src/app.ts" },
    ]);
  });
});
