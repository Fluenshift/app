import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  stages,
  vitestWorkspaces,
  workspaceDirectories,
} from "./test-reports.ts";

function fixture(): string {
  const root = mkdtempSync(path.join(tmpdir(), "test-reports-"));
  writeFileSync(
    path.join(root, "pnpm-workspace.yaml"),
    'packages:\n  - apps/*\n  - "smoke"\n\ncatalog:\n  vitest: 5.1.0\n'
  );
  const workspace = (dir: string, scripts: Record<string, string>) => {
    mkdirSync(path.join(root, dir), { recursive: true });
    writeFileSync(
      path.join(root, dir, "package.json"),
      JSON.stringify({ scripts })
    );
  };
  workspace("apps/server", { test: "vitest run" });
  workspace("apps/web", { build: "vite build", test: "node --test" });
  workspace("smoke", { smoke: "vitest run" });
  workspace("unlisted", { test: "vitest run" });
  return root;
}

describe("workspaceDirectories", () => {
  it("expands the packages that pnpm-workspace.yaml lists, and nothing after them", () => {
    const root = fixture();
    try {
      assert.deepEqual(workspaceDirectories(root).toSorted(), [
        path.join(root, "apps", "server"),
        path.join(root, "apps", "web"),
        path.join(root, "smoke"),
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("vitestWorkspaces", () => {
  it("keeps the workspaces whose test or smoke script runs Vitest", () => {
    const root = fixture();
    try {
      assert.deepEqual(vitestWorkspaces(root), [
        path.join(root, "apps", "server"),
        path.join(root, "smoke"),
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("stages", () => {
  const root = path.join(tmpdir(), "repo");
  const at = (...parts: readonly string[]) => path.join(root, ...parts);

  it("runs the database suite alone, then the Docker smoke beside the server suite, then each other suite alone", () => {
    assert.deepEqual(
      stages(root, [
        at("apps", "server"),
        at("apps", "web"),
        at("packages", "core"),
        at("packages", "db"),
        at("smoke"),
      ]),
      [
        [at("packages", "db")],
        [at("apps", "server"), at("smoke")],
        [at("apps", "web")],
        [at("packages", "core")],
      ]
    );
  });

  it("leaves out the stages whose suites do not exist", () => {
    assert.deepEqual(stages(root, [at("apps", "web"), at("smoke")]), [
      [at("smoke")],
      [at("apps", "web")],
    ]);
  });
});
