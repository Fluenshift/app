// The mutation spot-check of a unit (AGENTS.md, Work units, step 5): applies each mutation alone
// to one file, runs Vitest on the named test files, lists the tests that caught it, and always
// restores the file.
//
//   node scripts/migration/mutate.ts <workspace> <mutations.json>
//
// <mutations.json> is a list of `{ "file", "from", "to", "tests" }`: `file` relative to the
// workspace, `from` text that occurs exactly once in it, `to` its replacement, and `tests` the
// test files Vitest runs (all of the workspace's when absent). A mutation no test caught prints
// SURVIVED, and the script then exits 1.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { BaselineError } from "./baselines.ts";

export interface Mutation {
  readonly file: string;
  readonly from: string;
  readonly tests?: readonly string[];
  readonly to: string;
}

/** The text with `from` replaced once; refused unless `from` occurs exactly once. */
export function applyOnce(text: string, from: string, to: string): string {
  const count = text.split(from).length - 1;
  if (from === "" || count !== 1) {
    throw new BaselineError(
      `expected one match of ${JSON.stringify(from)}, found ${String(count)}`
    );
  }
  return text.replace(from, () => to);
}

interface VitestReport {
  readonly testResults?: readonly {
    readonly assertionResults?: readonly {
      readonly fullName?: string;
      readonly status?: string;
    }[];
    readonly message?: string;
    readonly name?: string;
    readonly status?: string;
  }[];
}

/** What failed in a Vitest JSON report: each failed test, and each file that failed to load. */
export function failedTests(report: VitestReport): string[] {
  const failed: string[] = [];
  for (const file of report.testResults ?? []) {
    const results = file.assertionResults ?? [];
    if (file.status === "failed" && results.length === 0) {
      failed.push(
        `file ${file.name ?? "?"}: ${(file.message ?? "").slice(0, 160)}`
      );
    }
    for (const test of results) {
      if (test.status !== "passed" && test.status !== "skipped") {
        failed.push(test.fullName ?? "?");
      }
    }
  }
  return failed;
}

function run(workspace: string, mutation: Mutation, report: string): string[] {
  const file = path.join(workspace, mutation.file);
  const original = readFileSync(file, "utf8");
  writeFileSync(file, applyOnce(original, mutation.from, mutation.to));
  try {
    try {
      execFileSync(
        "pnpm",
        [
          "exec",
          "vitest",
          "run",
          "--reporter=json",
          `--outputFile=${report}`,
          ...(mutation.tests ?? []),
        ],
        { cwd: workspace, stdio: "ignore" }
      );
    } catch {
      // Vitest exits 1 when a test fails, which is what a caught mutation looks like.
    }
    return failedTests(
      JSON.parse(readFileSync(report, "utf8")) as VitestReport
    );
  } finally {
    writeFileSync(file, original);
  }
}

function main(argv: readonly string[]): void {
  const [workspace, list] = argv;
  if (workspace === undefined || list === undefined) {
    throw new BaselineError(
      "usage: node scripts/migration/mutate.ts <workspace> <mutations.json>"
    );
  }
  const mutations = JSON.parse(readFileSync(list, "utf8")) as Mutation[];
  const scratch = mkdtempSync(path.join(tmpdir(), "mutate-"));
  let survived = 0;
  try {
    for (const mutation of mutations) {
      const caught = run(
        workspace,
        mutation,
        path.join(scratch, "report.json")
      );
      console.log(
        `\n${mutation.file}: ${JSON.stringify(mutation.from)} -> ${JSON.stringify(mutation.to)}`
      );
      if (caught.length === 0) {
        survived += 1;
        console.log("  SURVIVED");
      }
      for (const test of caught) console.log(`  caught by: ${test}`);
    }
  } finally {
    rmSync(scratch, { force: true, recursive: true });
  }
  if (survived > 0) process.exitCode = 1;
}

if (import.meta.main) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
