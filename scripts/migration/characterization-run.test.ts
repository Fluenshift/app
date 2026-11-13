import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { PLANS } from "./baseline-run.ts";
import { copyFiles, listFiles, selectSuites } from "./characterization-run.ts";

const scratch = () => mkdtempSync(path.join(os.tmpdir(), "characterization-"));

describe("selectSuites", () => {
  it("runs each test with the suite that owns its directory", () => {
    const plan = PLANS["pe"];
    assert.ok(plan !== undefined);

    const suites = selectSuites(plan, [
      "apps/server/src/evaluation/utf8.characterization.test.ts",
      "apps/server/src/helper.ts",
      "apps/web/src/features/-x.characterization.test.tsx",
      "packages/db/src/y.characterization.test.ts",
    ]);

    assert.deepEqual(
      suites.map((suite) => [suite.id, suite.command]),
      [
        [
          "server",
          [
            "bun",
            "test",
            "src/evaluation/utf8.characterization.test.ts",
            "--reporter=junit",
            "--reporter-outfile={report}",
          ],
        ],
        [
          "db",
          [
            "bun",
            "test",
            "src/y.characterization.test.ts",
            "--reporter=junit",
            "--reporter-outfile={report}",
          ],
        ],
        [
          "web",
          [
            "bun",
            "run",
            "test",
            "src/features/-x.characterization.test.tsx",
            "--reporter=default",
            "--reporter=json",
            "--outputFile.json={report}",
          ],
        ],
      ]
    );
  });

  it("keeps Grifando paths relative to its root", () => {
    const plan = PLANS["grifando"];
    assert.ok(plan !== undefined);

    const [suite] = selectSuites(plan, [
      "src/app/api/vocabulary/route.characterization.test.ts",
    ]);

    assert.deepEqual(suite?.command.slice(0, 5), [
      "pnpm",
      "exec",
      "vitest",
      "run",
      "src/app/api/vocabulary/route.characterization.test.ts",
    ]);
  });

  it("refuses a test that no suite owns", () => {
    const plan = PLANS["pe"];
    assert.ok(plan !== undefined);

    assert.throws(
      () => selectSuites(plan, ["scripts/z.characterization.test.ts"]),
      /expected exactly one suite to own it, found 0/
    );
    assert.throws(
      () => selectSuites(plan, ["e2e/journey.characterization.test.ts"]),
      /found 0/
    );
  });
});

describe("files", () => {
  it("lists nested files in order and copies them without replacing anything", () => {
    const source = scratch();
    const worktree = scratch();
    mkdirSync(path.join(source, "b/c"), { recursive: true });
    writeFileSync(path.join(source, "b/c/two.ts"), "two");
    writeFileSync(path.join(source, "a.ts"), "one");

    const files = listFiles(source);
    assert.deepEqual(files, ["a.ts", "b/c/two.ts"]);
    assert.deepEqual(listFiles(path.join(source, "missing")), []);

    copyFiles(source, worktree, files);
    assert.equal(
      readFileSync(path.join(worktree, "b/c/two.ts"), "utf8"),
      "two"
    );

    assert.throws(
      () => copyFiles(source, worktree, ["a.ts"]),
      /never replaces baseline files/
    );
  });
});
