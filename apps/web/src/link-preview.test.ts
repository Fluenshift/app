// Grifando's metadata, src/app/layout.tsx (74dbb9f), in the application shell with Fluenshift's
// name, static at build in both profiles, and Grifando's Open Graph card,
// src/app/opengraph-image.tsx, as a static file of the build. The hosted server adds the card's
// tags at its public origin (docs/adr/0040).
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const DESCRIPTION =
  "Personal writing coach for English, built from your own mistakes.";

const shellHead = () =>
  new DOMParser().parseFromString(
    readFileSync(path.join(import.meta.dirname, "../index.html"), "utf-8"),
    "text/html"
  ).head;

describe("link preview", () => {
  it("describes Fluenshift in the shell as Grifando's metadata described Grifando", () => {
    const head = shellHead();

    expect(head.querySelector("title")?.textContent).toBe("Fluenshift");
    expect(
      Array.from(
        head.querySelectorAll(
          "meta[name='description'], meta[property^='og:'], meta[name^='twitter:']"
        ),
        (meta) => [
          meta.getAttribute("name") ?? meta.getAttribute("property"),
          meta.getAttribute("content"),
        ]
      )
    ).toEqual([
      ["description", DESCRIPTION],
      ["og:type", "website"],
      ["og:site_name", "Fluenshift"],
      ["og:title", "Fluenshift"],
      ["og:description", DESCRIPTION],
      ["twitter:card", "summary_large_image"],
      ["twitter:title", "Fluenshift"],
      ["twitter:description", DESCRIPTION],
    ]);
  });

  it("ships the Open Graph card as a 1200 by 630 PNG", () => {
    const card = readFileSync(
      path.join(import.meta.dirname, "../public/og-image.png")
    );

    expect([...card.subarray(0, 8)]).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect([card.readUInt32BE(16), card.readUInt32BE(20)]).toEqual([1200, 630]);
  });
});
