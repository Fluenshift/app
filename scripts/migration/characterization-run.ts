// Runs the characterization tests of one baseline: tests kept in this repository, written
// in the baseline's own idiom, that pin behavior no baseline test covers.
//
//   node scripts/migration/characterization-run.ts <system> [--root <dir>]
//
// The files live in migration/characterization/<system>/files/<path>, where <path> is the
// place they take inside the baseline. The script creates a fresh disposable worktree at the
// pin (<root>/worktrees/<system>-characterization), installs under the same scrubbed
// environment as baseline-run.ts, copies the files in without overwriting anything, runs
// only the *.characterization.test.ts(x) files with each suite's machine-readable reporter,
// and stores normalized reports and a manifest in migration/characterization/<system>/reports/.
// Exits 1 when any characterization test fails: a red characterization pins nothing.

import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { executeRun } from "./baseline-run.ts";
import type { Plan, Suite } from "./baseline-run.ts";
import { BaselineError, defaultRoot, repoRoot } from "./baselines.ts";

const CHARACTERIZATION_TEST = /\.characterization\.test\.tsx?$/;

export function characterizationDir(system: string): string {
  return path.join(repoRoot, "migration", "characterization", system);
}

// Every file under `dir`, as sorted POSIX paths relative to it.
export function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path
        .relative(dir, path.join(entry.parentPath, entry.name))
        .split(path.sep)
        .join("/")
    )
    .toSorted();
}

// One suite per baseline suite that owns characterization tests. A test belongs to the single
// suite whose `filesRoot` contains it; helper files beside the tests are copied but not run.
export function selectSuites(plan: Plan, files: readonly string[]): Suite[] {
  const owned = new Map<Suite, string[]>();
  for (const file of files) {
    if (!CHARACTERIZATION_TEST.test(file)) continue;
    const owners = plan.suites.filter(
      (suite) =>
        suite.filesRoot !== undefined &&
        suite.filesCommand !== undefined &&
        file.startsWith(suite.filesRoot)
    );
    const [owner] = owners;
    if (owner === undefined || owners.length !== 1)
      throw new BaselineError(
        `${file}: expected exactly one suite to own it, found ${owners.length}`
      );
    owned.set(owner, [...(owned.get(owner) ?? []), file]);
  }
  return plan.suites.flatMap((suite) => {
    const tests = owned.get(suite);
    if (tests === undefined || suite.filesCommand === undefined) return [];
    const relative = tests.map((file) => path.posix.relative(suite.cwd, file));
    return [
      {
        ...suite,
        command: suite.filesCommand.flatMap((part) =>
          part === "{files}" ? relative : [part]
        ),
      },
    ];
  });
}

// Copies the characterization files into the worktree. Nothing in the baseline is replaced.
export function copyFiles(
  source: string,
  worktree: string,
  files: readonly string[]
): void {
  for (const file of files) {
    const destination = path.join(worktree, file);
    if (existsSync(destination))
      throw new BaselineError(
        `${file} already exists in the baseline; characterization never replaces baseline files`
      );
    mkdirSync(path.dirname(destination), { recursive: true });
    cpSync(path.join(source, file), destination);
  }
}

function main(argv: readonly string[]): number {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: { root: { type: "string" } },
  });
  const [system, ...extra] = positionals;
  if (system === undefined || extra.length > 0)
    throw new BaselineError(
      "usage: characterization-run.ts <system> [--root <dir>]"
    );
  const source = path.join(characterizationDir(system), "files");
  const files = listFiles(source);
  if (!files.some((file) => CHARACTERIZATION_TEST.test(file)))
    throw new BaselineError(
      `${path.relative(repoRoot, source)} holds no *.characterization.test.ts file`
    );
  return executeRun({
    system,
    root: values.root === undefined ? defaultRoot : path.resolve(values.root),
    worktreeName: "characterization",
    outDir: path.join(characterizationDir(system), "reports"),
    plan: (plan, worktree) => {
      copyFiles(source, worktree, files);
      return { suites: selectSuites(plan, files), files };
    },
  });
}

if (import.meta.main) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
