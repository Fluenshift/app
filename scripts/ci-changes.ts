// Decides which CI jobs a change needs, from the files it touches (ADR 0019).
//
//   node scripts/ci-changes.ts --base <commit> --head <commit>
//
// Prints two GitHub Actions outputs, `code=<bool>` and `gates=<bool>`:
// - `code` is false when every changed file is Markdown. No suite reads Markdown, so the
//   workflow then runs the static checks and the secret scan alone. The static checks cover what
//   does read it: the documented commands and the ADR status lines of the ledger check.
// - `gates` is true when the change touches a gate: a script, a gate's configuration, the
//   toolchain, or a file that a gate self-test edits or runs. Only then does the workflow run the
//   gate self-tests.
// Both are true when the change cannot be read: no base (a manual run) or a commit git does not
// know (the all-zero base of a new branch). An unknown change skips nothing.

import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";

import { SELF_TEST_FIXTURES } from "./gate-selftest.ts";
import { BaselineError, repoRoot } from "./migration/baselines.ts";

export interface Changes {
  readonly code: boolean;
  readonly gates: boolean;
}

export const EVERYTHING: Changes = { code: true, gates: true };

const MARKDOWN = /\.md$/;

// What the gates are made of. The lint, TypeScript, formatter, Vite, Vitest and Playwright
// configurations and the hooks are the files scripts/check-gates.ts records.
const GATE_PATHS: readonly RegExp[] = [
  /^\.github\/workflows\//,
  /^\.husky\//,
  /^\.node-version$/,
  /^gates\//,
  /^scripts\//,
  /^packages\/config\//,
  /^pnpm-(?:lock|workspace)\.yaml$/,
  /^(?:oxfmt|oxlint)(?:\.[\w-]+)?\.config\.[cm]?[jt]s$/,
  /(?:^|\/)package\.json$/,
  /(?:^|\/)tsconfig(?:\.[\w-]+)?\.json$/,
  /(?:^|\/)(?:vite|vitest|playwright)(?:\.[\w-]+)?\.config\.[cm]?[jt]s$/,
];

export function classify(files: readonly string[]): Changes {
  const code = files.filter((file) => !MARKDOWN.test(file));
  return {
    code: code.length > 0,
    gates: code.some(
      (file) =>
        SELF_TEST_FIXTURES.includes(file) ||
        GATE_PATHS.some((pattern) => pattern.test(file))
    ),
  };
}

export function outputLines(changes: Changes): string[] {
  return [`code=${changes.code}`, `gates=${changes.gates}`];
}

// The files that differ between the head and its merge base with `base`, a renamed file under
// both names, or undefined when git cannot tell.
export function changedFiles(base: string, head: string): string[] | undefined {
  if (base === "" || head === "") return undefined;
  try {
    return execFileSync(
      "git",
      ["diff", "--name-only", "--no-renames", "-z", `${base}...${head}`],
      { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    )
      .split("\0")
      .filter((file) => file !== "");
  } catch {
    return undefined;
  }
}

function main(argv: readonly string[]): number {
  const { values } = parseArgs({
    args: [...argv],
    options: { base: { type: "string" }, head: { type: "string" } },
  });
  if (values.base === undefined || values.head === undefined)
    throw new BaselineError(
      "usage: ci-changes.ts --base <commit> --head <commit>"
    );
  const files = changedFiles(values.base, values.head);
  const lines = outputLines(files === undefined ? EVERYTHING : classify(files));
  console.error(
    files === undefined
      ? `ci-changes: the change is unknown, so nothing is skipped (${lines.join(", ")})`
      : `ci-changes: ${files.length} changed files (${lines.join(", ")})`
  );
  for (const line of lines) console.log(line);
  return 0;
}

if (import.meta.main) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
