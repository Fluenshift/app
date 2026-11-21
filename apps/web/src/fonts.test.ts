// Grifando's type applies to the whole product (docs/adr/0009). Grifando loaded three OFL faces
// with next/font, latin only, at these weights and styles (src/app/layout.tsx, 74dbb9f); the
// application's styles import the same files from @fontsource, so the build serves them itself
// and no page asks another origin for a font (#275).
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const FACES = [
  "@fontsource/inter/latin-300.css",
  "@fontsource/inter/latin-400.css",
  "@fontsource/inter/latin-500.css",
  "@fontsource/jetbrains-mono/latin-400.css",
  "@fontsource/jetbrains-mono/latin-500.css",
  "@fontsource/source-serif-4/latin-300.css",
  "@fontsource/source-serif-4/latin-300-italic.css",
  "@fontsource/source-serif-4/latin-400.css",
  "@fontsource/source-serif-4/latin-400-italic.css",
];

const read = (relative: string) =>
  readFileSync(path.join(import.meta.dirname, relative), "utf-8");

describe("bundled type", () => {
  it("imports Grifando's three faces at its weights and styles, latin only", () => {
    const imported = Array.from(
      read("index.css").matchAll(/@import "(?<face>@fontsource\/[^"]+)";/gu),
      (match) => match.groups?.["face"]
    );

    expect(imported).toStrictEqual(FACES);
    expect(
      FACES.filter(
        (face) =>
          !existsSync(path.join(import.meta.dirname, "../node_modules", face))
      )
    ).toStrictEqual([]);
  });

  it("draws the hand note in the serif italic, turned as Grifando's was", () => {
    expect(read("../../../packages/ui/src/styles/globals.css")).toContain(
      ".hand-note {\n  font-family: var(--font-serif);\n  font-style: italic;\n  font-weight: 400;\n  transform: rotate(-4deg);\n}"
    );
  });
});
