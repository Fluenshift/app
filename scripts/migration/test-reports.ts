// Runs every Vitest suite with a JSON reporter, for parity-check.ts.
//
//   node scripts/migration/test-reports.ts <dir>
//
// A suite is a workspace whose `test` or `smoke` script runs Vitest. The `smoke` workspace holds
// the Docker smoke, which builds and starts the image of the local profile, so this needs
// Docker. Workspaces are those pnpm-workspace.yaml lists. Writes <dir>/<workspace>.json for each
// suite and exits 1 if any suite fails. The reports keep absolute paths; parity-check makes
// them relative.
//
// The suites run in stages (#115). `packages/db` runs alone first: its PGlite cases time out
// under load with Vitest's 5-second default (#72). The Docker smoke then runs beside the server
// suite: the smoke spends most of its time building and starting the image, and the server's
// tests allow 60 seconds. Every other suite runs alone, so timing-sensitive tests, such as the
// web app's 1-second Testing Library queries, never share the machine.

import { spawn } from "node:child_process";
import { once } from "node:events";
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

// Workspaces by their path from the repository root.
const ALONE_FIRST = "packages/db";
const TOGETHER = new Set(["apps/server", "smoke"]);

// Groups suites into stages: the suites of a stage run at the same time, and the stages run one
// after the other.
export function stages(
  root: string,
  workspaces: readonly string[]
): string[][] {
  const name = (workspace: string) =>
    path.relative(root, workspace).split(path.sep).join("/");
  const rest = workspaces.filter(
    (workspace) =>
      name(workspace) !== ALONE_FIRST && !TOGETHER.has(name(workspace))
  );
  return [
    workspaces.filter((workspace) => name(workspace) === ALONE_FIRST),
    workspaces.filter((workspace) => TOGETHER.has(name(workspace))),
    ...rest.map((workspace) => [workspace]),
  ].filter((stage) => stage.length > 0);
}

// Runs one suite with a JSON report; resolves true when it passed.
const runSuite = async (workspace: string, out: string) => {
  const report = path.join(out, `${path.basename(workspace)}.json`);
  const suite = spawn(
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
  const [code] = (await once(suite, "close")) as [number | null];
  return code === 0;
};

// Runs every stage, even after a failure, so that every report is written; resolves true when
// every suite passed.
const runStages = async (
  remaining: readonly (readonly string[])[],
  out: string
): Promise<boolean> => {
  const [stage, ...later] = remaining;
  if (stage === undefined) {
    return true;
  }
  const results = await Promise.all(
    stage.map((workspace) => runSuite(workspace, out))
  );
  const passedLater = await runStages(later, out);
  return passedLater && results.every(Boolean);
};

async function main(argv: readonly string[]): Promise<number> {
  const [target, ...extra] = argv;
  if (target === undefined || extra.length > 0)
    throw new BaselineError("usage: test-reports.ts <dir>");
  const out = path.resolve(target);
  mkdirSync(out, { recursive: true });
  const passed = await runStages(
    stages(repoRoot, vitestWorkspaces(repoRoot)),
    out
  );
  return passed ? 0 : 1;
}

if (import.meta.main) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
