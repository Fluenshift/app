// Characterization of apps/server/src/evaluation/utf8.ts and of the UTF-8 edge cases of
// applyCorrections (rubric-v1.ts) at the PE baseline. utf8.ts has no test of its own, and its
// Buffer round trip must survive the port to TextEncoder and TextDecoder: a default
// TextDecoder drops a leading BOM, Buffer does not.
import { describe, expect, it } from "bun:test";

import { Effect } from "effect";

import { applyCorrections } from "./rubric-v1";
import { isUtf8ByteBoundary, isWellFormedUtf8String } from "./utf8";

const OUTSIDE_OR_OVERLAPPING =
  "Correction spans overlap or are outside Writing Sample";
const SOURCE_MISMATCH = "Correction source does not match Writing Sample bytes";

const rejection = (
  original: string,
  corrections: Parameters<typeof applyCorrections>[1]
) => Effect.runPromise(Effect.flip(applyCorrections(original, corrections)));

describe("UTF-8 helpers", () => {
  it("accepts every well-formed string, including a BOM and U+FFFD", () => {
    expect(isWellFormedUtf8String("")).toBe(true);
    expect(isWellFormedUtf8String("plain ASCII")).toBe(true);
    expect(isWellFormedUtf8String("Olá, naïve café")).toBe(true);
    expect(isWellFormedUtf8String("emoji ✅ 😀")).toBe(true);
    expect(isWellFormedUtf8String("﻿starts with a BOM")).toBe(true);
    expect(isWellFormedUtf8String("replacement � character")).toBe(true);
  });

  it("rejects lone surrogates", () => {
    expect(isWellFormedUtf8String("\uD83D")).toBe(false);
    expect(isWellFormedUtf8String("\uDE00")).toBe(false);
    expect(isWellFormedUtf8String("a\uD83Db")).toBe(false);
    expect(isWellFormedUtf8String("\uDE00\uD83D")).toBe(false);
  });

  it("treats the start, the end and every lead byte as a boundary", () => {
    // 61 | C3 A9 | F0 9F 98 80
    const source = Buffer.from("aé😀", "utf-8");

    expect(source.byteLength).toBe(7);
    expect(
      [0, 1, 2, 3, 4, 5, 6, 7].map((offset) =>
        isUtf8ByteBoundary(source, offset)
      )
    ).toEqual([true, true, false, true, false, false, false, true]);
  });

  it("treats the only offset of an empty buffer as a boundary", () => {
    expect(isUtf8ByteBoundary(Buffer.alloc(0), 0)).toBe(true);
  });

  it("treats offsets outside the buffer or between bytes as no boundary", () => {
    const source = Buffer.from("é", "utf-8");

    expect(isUtf8ByteBoundary(source, -1)).toBe(false);
    expect(isUtf8ByteBoundary(source, 3)).toBe(false);
    expect(isUtf8ByteBoundary(source, 0.5)).toBe(false);
  });
});

describe("applyCorrections UTF-8 edge cases", () => {
  it("returns the sample unchanged without corrections", async () => {
    const corrected = await Effect.runPromise(
      applyCorrections("﻿nothing to fix ✅", [])
    );

    expect(corrected).toBe("﻿nothing to fix ✅");
  });

  it("keeps a leading BOM when a later span is corrected", async () => {
    const corrected = await Effect.runPromise(
      applyCorrections("﻿fail twice", [
        { byteEnd: 7, byteStart: 3, correction: "fails", originalText: "fail" },
      ])
    );

    expect(corrected).toBe("﻿fails twice");
  });

  it("matches a span whose original text starts with a BOM", async () => {
    const corrected = await Effect.runPromise(
      applyCorrections("﻿fail twice", [
        {
          byteEnd: 7,
          byteStart: 0,
          correction: "fails",
          originalText: "﻿fail",
        },
      ])
    );

    expect(corrected).toBe("fails twice");
  });

  it("applies several corrections whatever their order", async () => {
    const corrected = await Effect.runPromise(
      applyCorrections("file are missing", [
        { byteEnd: 4, byteStart: 0, correction: "files", originalText: "file" },
        { byteEnd: 16, byteStart: 9, correction: "absent", originalText: "missing" },
      ])
    );

    expect(corrected).toBe("files are absent");
  });

  it("allows adjacent spans", async () => {
    const corrected = await Effect.runPromise(
      applyCorrections("ab", [
        { byteEnd: 1, byteStart: 0, correction: "x", originalText: "a" },
        { byteEnd: 2, byteStart: 1, correction: "y", originalText: "b" },
      ])
    );

    expect(corrected).toBe("xy");
  });

  it("gives one reason for spans outside the sample, empty, overlapping or split", async () => {
    const cases: Parameters<typeof applyCorrections>[1][] = [
      [{ byteEnd: 99, byteStart: 0, correction: "x", originalText: "file" }],
      [{ byteEnd: 4, byteStart: -1, correction: "x", originalText: "file" }],
      [{ byteEnd: 2, byteStart: 2, correction: "x", originalText: "" }],
      [{ byteEnd: 1.5, byteStart: 0, correction: "x", originalText: "f" }],
      [
        { byteEnd: 8, byteStart: 5, correction: "is", originalText: "are" },
        { byteEnd: 12, byteStart: 7, correction: "x", originalText: "e mis" },
      ],
    ];

    for (const corrections of cases) {
      const error = await rejection("file are missing", corrections);

      expect(error._tag).toBe("UnsafeCorrectionError");
      expect(error.reason).toBe(OUTSIDE_OR_OVERLAPPING);
    }

    const split = await rejection("é is valid", [
      { byteEnd: 1, byteStart: 0, correction: "e", originalText: "�" },
    ]);

    expect(split.reason).toBe(OUTSIDE_OR_OVERLAPPING);
  });

  it("gives the same reason for an ill-formed correction", async () => {
    const error = await rejection("file are missing", [
      { byteEnd: 4, byteStart: 0, correction: "\uD83D", originalText: "file" },
    ]);

    expect(error.reason).toBe(OUTSIDE_OR_OVERLAPPING);
  });

  it("gives another reason when the span's bytes differ from its original text", async () => {
    const error = await rejection("file are missing", [
      { byteEnd: 4, byteStart: 0, correction: "files", originalText: "fill" },
    ]);

    expect(error._tag).toBe("UnsafeCorrectionError");
    expect(error.reason).toBe(SOURCE_MISMATCH);
  });
});
