// Runs every workspace's Vitest suite with a JSON reporter, for parity-check.ts.
//
//   node scripts/migration/test-reports.ts <dir>
//
// Writes <dir>/<workspace>.json for each workspace whose `test` script runs Vitest, and exits
// 1 if any suite fails. The reports keep absolute paths; parity-check makes them relative.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { BaselineError, repoRoot } from "./baselines.ts";

export function vitestWorkspaces(root: string): string[] {
  return ["apps", "packages"].flatMap((group) => {
    const dir = path.join(root, group);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .map((name) => path.join(dir, name))
      .filter((workspace) => {
        const manifest = path.join(workspace, "package.json");
        if (!existsSync(manifest)) return false;
        const { scripts } = JSON.parse(readFileSync(manifest, "utf8")) as {
          readonly scripts?: Readonly<Record<string, string>>;
        };
        return scripts?.["test"]?.startsWith("vitest") ?? false;
      })
      .toSorted();
  });
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
