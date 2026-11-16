import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  changedFiles,
  classify,
  EVERYTHING,
  outputLines,
} from "./ci-changes.ts";
import { SELF_TEST_FIXTURES } from "./gate-selftest.ts";

describe("ci-changes", () => {
  it("runs the static checks alone for a change that is only Markdown", () => {
    assert.deepEqual(
      classify(["SESSION_HANDOFF.md", "docs/adr/0019-lighter-gates.md"]),
      { code: false, gates: false }
    );
  });

  it("runs the suites for a change to product code", () => {
    assert.deepEqual(
      classify(["apps/server/src/academy/interview-service.ts", "README.md"]),
      { code: true, gates: false }
    );
  });

  it("treats the ledger and the inventory as code, since gates read them", () => {
    assert.deepEqual(
      classify([
        "docs/migration/parity/academy-http.json",
        "docs/migration/inventory/grifando.json",
      ]),
      { code: true, gates: false }
    );
  });

  it("runs the gate self-tests when a gate, its configuration or the toolchain changes", () => {
    for (const file of [
      ".github/workflows/ci.yml",
      ".husky/pre-commit",
      ".node-version",
      "apps/server/package.json",
      "apps/server/vitest.config.ts",
      "apps/web/vite.config.ts",
      "gates/baseline.json",
      "oxfmt.config.ts",
      "oxlint.config.ts",
      "oxlint.effect.config.ts",
      "package.json",
      "packages/config/tsconfig.base.json",
      "packages/core/tsconfig.json",
      "playwright.config.ts",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "scripts/check-gates.ts",
      "scripts/migration/parity-check.ts",
    ])
      assert.deepEqual(classify([file]), { code: true, gates: true }, file);
  });

  it("runs the gate self-tests when a file they edit or run changes", () => {
    assert.ok(SELF_TEST_FIXTURES.length > 0);
    for (const file of SELF_TEST_FIXTURES)
      assert.deepEqual(classify([file]), { code: true, gates: true }, file);
  });

  it("leaves the gate self-tests out for other product files", () => {
    assert.deepEqual(
      classify([
        "apps/server/src/app.ts",
        "apps/web/src/api.ts",
        "packages/core/src/rubric-v1.ts",
        "packages/db/src/migrations/0004_interview/migration.sql",
      ]),
      { code: true, gates: false }
    );
  });

  it("leaves Markdown out of the gates, wherever it lives", () => {
    assert.deepEqual(classify(["scripts/README.md", "gates/NOTES.md"]), {
      code: false,
      gates: false,
    });
  });

  it("needs nothing for an empty change", () => {
    assert.deepEqual(classify([]), { code: false, gates: false });
  });

  it("skips nothing when the change is unknown", () => {
    assert.deepEqual(EVERYTHING, { code: true, gates: true });
    assert.equal(changedFiles("", "HEAD"), undefined);
    assert.equal(changedFiles("HEAD", ""), undefined);
    assert.equal(changedFiles("0".repeat(40), "HEAD"), undefined);
    assert.equal(changedFiles("f".repeat(40), "HEAD"), undefined);
  });

  it("reads an unchanged tree as an empty change", () => {
    assert.deepEqual(changedFiles("HEAD", "HEAD"), []);
  });

  it("prints one GitHub output per line", () => {
    assert.deepEqual(outputLines({ code: true, gates: false }), [
      "code=true",
      "gates=false",
    ]);
  });
});
