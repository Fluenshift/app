// Runs every Vitest suite with a JSON reporter, for parity-check.ts.
//
//   node scripts/migration/test-reports.ts <dir>
//
// A suite is a workspace whose `test` or `smoke` script runs Vitest. The `smoke` workspace holds
// the Docker smoke, which builds and starts the image of the local profile, so this needs
// Docker. Workspaces are those pnpm-workspace.yaml lists. Writes <dir>/<workspace>.json for each
// suite and exits 1 if any suite fails. The reports keep absolute paths; parity-check makes
// them relative.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { BaselineError, repoRoot } from "./baselines.ts";

export const SUITE_SCRIPTS = ["test", "smoke"];

// The directories of the `packages` list of pnpm-workspace.yaml: `dir/*` names every directory
// in dir, anything else names one directory.
export function workspaceDirectories(root: string): string[] {
  const lines = readFileSync(path.join(root, "pnpm-workspace.yaml"), "utf8")
    .split("\n")
    .map((line) => line.trimEnd());
  const patterns: string[] = [];
  for (const line of lines.slice(lines.indexOf("packages:") + 1)) {
    const entry = /^\s+-\s+["']?([^"'\s]+)["']?$/.exec(line);
    if (entry === null) break;
    patterns.push(entry[1] ?? "");
  }
  return patterns.flatMap((pattern) => {
    if (!pattern.endsWith("/*")) return [path.join(root, pattern)];
    const dir = path.join(root, pattern.slice(0, -2));
    return existsSync(dir)
      ? readdirSync(dir).map((name) => path.join(dir, name))
      : [];
  });
}

export function vitestWorkspaces(root: string): string[] {
  return workspaceDirectories(root)
    .filter((workspace) => {
      const manifest = path.join(workspace, "package.json");
      if (!existsSync(manifest)) return false;
      const { scripts } = JSON.parse(readFileSync(manifest, "utf8")) as {
        readonly scripts?: Readonly<Record<string, string>>;
      };
      return SUITE_SCRIPTS.some(
        (name) => scripts?.[name]?.startsWith("vitest") ?? false
      );
    })
    .toSorted();
}

function main(argv: readonly string[]): number {
  const [target, ...extra] = argv;
  if (target === undefined || extra.length > 0)
    throw new BaselineError("usage: test-reports.ts <dir>");
  const out = path.resolve(target);
  mkdirSync(out, { recursive: true });
  let failed = false;
  for (const workspace of vitestWorkspaces(repoRoot)) {
    const report = path.join(out, `${path.basename(workspace)}.json`);
    const result = spawnSync(
      "pnpm",
      [
        "exec",
        "vitest",
        "run",
        "--passWithNoTests",
        "--reporter=dot",
        "--reporter=json",
        `--outputFile.json=${report}`,
      ],
      { cwd: workspace, stdio: "inherit" }
    );
    if (result.status !== 0) failed = true;
  }
  return failed ? 1 : 0;
}

if (import.meta.main) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
