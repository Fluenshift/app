import type {
  EvaluationFinding,
  EvaluationSuggestion,
} from "@fluenshift/contract";
import { describe, expect, test } from "vitest";

import { buildTextSpans } from "./spell-checker";

const finding = (
  originalText: string,
  offsets: { byteEnd?: number; byteStart?: number } = {}
): EvaluationFinding => ({
  ...offsets,
  category: "Spelling",
  correction: "test",
  explanation: "The letters are reversed.",
  originalText,
  severity: "Minor",
});

const spans = (
  text: string,
  findings: readonly EvaluationFinding[],
  suggestions: readonly EvaluationSuggestion[] = []
) =>
  buildTextSpans(text, findings, suggestions).map(({ end, id, start }) => ({
    end,
    id,
    start,
  }));

describe("SpellChecker mark placement", () => {
  test("places a mark at UTF-8 byte offsets that hold its text, otherwise at an occurrence of the text", () => {
    const text = "Café tset, tset.";

    expect(
      [
        { byteEnd: 16, byteStart: 12 },
        { byteEnd: 15, byteStart: 11 },
        { byteEnd: 12, byteStart: 12 },
        { byteEnd: 40, byteStart: 12 },
        {},
      ].map((offsets) => spans(text, [finding("tset", offsets)]))
    ).toEqual([
      [{ end: 15, id: "finding-0", start: 11 }],
      [{ end: 9, id: "finding-0", start: 5 }],
      [{ end: 9, id: "finding-0", start: 5 }],
      [{ end: 9, id: "finding-0", start: 5 }],
      [{ end: 9, id: "finding-0", start: 5 }],
    ]);
  });

  test("searches from the start when no occurrence follows the previous mark", () => {
    expect(
      spans("a tset b tset", [finding("tset"), finding("b"), finding("a")])
    ).toEqual([
      { end: 1, id: "finding-2", start: 0 },
      { end: 6, id: "finding-0", start: 2 },
      { end: 8, id: "finding-1", start: 7 },
    ]);
  });

  test("keeps a span for its Finding when a Suggestion names the same text", () => {
    expect(
      spans(
        "Fix tset now.",
        [finding("tset")],
        [
          {
            alternative: "test",
            explanation: "Same words.",
            originalText: "tset",
          },
          {
            alternative: "later",
            explanation: "Softer.",
            originalText: "now",
          },
        ]
      )
    ).toEqual([
      { end: 8, id: "finding-0", start: 4 },
      { end: 12, id: "suggestion-1", start: 9 },
    ]);
  });
});

// Grifando #78: its highlighter placed each span with `indexOf`, so a short span landed inside an
// earlier word and a repeated Finding lost its second mark. A stored Finding carries validated
// byte offsets (docs/adr/0004), so each mark sits where its Finding is. These are the issue's two
// texts; they are ASCII, so byte offsets are character offsets.
describe("SpellChecker marks for Grifando #78", () => {
  test("marks a short Finding at its own word, not inside an earlier one", () => {
    expect(
      spans("I have a idea for the API.", [
        finding("a", { byteEnd: 8, byteStart: 7 }),
      ])
    ).toEqual([{ end: 8, id: "finding-0", start: 7 }]);
  });

  test("marks a repeated Finding at each of its own occurrences, in order", () => {
    expect(
      spans("This PR fix the login and fix the logout.", [
        finding("fix", { byteEnd: 11, byteStart: 8 }),
        finding("fix", { byteEnd: 29, byteStart: 26 }),
      ])
    ).toEqual([
      { end: 11, id: "finding-0", start: 8 },
      { end: 29, id: "finding-1", start: 26 },
    ]);
  });
});
