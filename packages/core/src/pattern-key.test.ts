import { describe, expect, it } from "vitest";

import { normalizePatternKey } from "./pattern-key";

describe("normalizePatternKey", () => {
  it("lowercases and trims", () => {
    expect(normalizePatternKey("  Depend On  ")).toBe("depend-on");
  });

  it("collapses non-alphanumeric runs into single dashes", () => {
    expect(normalizePatternKey("verb + gerund: difficulty!!")).toBe(
      "verb-gerund-difficulty"
    );
  });

  it("strips leading and trailing dashes", () => {
    expect(normalizePatternKey("--preposition--")).toBe("preposition");
  });

  it("caps length at 64 characters without a trailing dash", () => {
    const long = "a".repeat(70);
    const result = normalizePatternKey(long);
    expect(result.length).toBeLessThanOrEqual(64);
    expect(result.endsWith("-")).toBe(false);
  });

  it("falls back to a stable key when normalization empties the string", () => {
    expect(normalizePatternKey("!!!")).toBe("unspecified");
  });

  it("treats different raw casings/punctuation of the same concept as identical keys", () => {
    expect(normalizePatternKey("Depend On")).toBe(
      normalizePatternKey("depend-on")
    );
  });
});
