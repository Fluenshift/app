import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { checkMarkdown, codeLines } from "./check-doc-commands.ts";

const scripts = new Set(["verify", "test", "test:e2e"]);
const exists = (file: string) => file === "scripts/migration/inventory.ts";

describe("codeLines", () => {
  it("keeps fenced blocks and code spans, not prose", () => {
    const markdown = [
      "Run pnpm ghost in prose.",
      "Use `pnpm verify` here.",
      "```bash",
      "pnpm test",
      "```",
    ].join("\n");

    assert.deepEqual(codeLines(markdown), [
      { line: 2, text: "pnpm verify" },
      { line: 4, text: "pnpm test" },
    ]);
  });
});

describe("checkMarkdown", () => {
  it("accepts root scripts, pnpm built-ins and existing scripts", () => {
    const markdown = [
      "```bash",
      "pnpm install --frozen-lockfile && pnpm verify",
      "pnpm exec playwright test",
      "mise exec node@26.13.0 -- node scripts/migration/inventory.ts --check",
      "```",
    ].join("\n");

    assert.deepEqual(
      checkMarkdown("README.md", markdown, scripts, exists, true),
      []
    );
  });

  it("reports unknown scripts and missing files", () => {
    const markdown = "`pnpm lint:all` then `node scripts/migration/gone.ts`";

    assert.deepEqual(
      checkMarkdown("README.md", markdown, scripts, exists, true).map(
        (problem) => problem.message
      ),
      [
        "pnpm lint:all is not a root script",
        "scripts/migration/gone.ts does not exist",
      ]
    );
  });

  it("checks only script paths outside the root docs", () => {
    const markdown =
      "`pnpm db:test:prepare` and `node scripts/migration/gone.ts`";

    assert.deepEqual(
      checkMarkdown(
        "docs/migration/BASELINES.md",
        markdown,
        scripts,
        exists,
        false
      ).map((problem) => problem.message),
      ["scripts/migration/gone.ts does not exist"]
    );
  });
});
