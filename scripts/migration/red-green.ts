// Gate G8: a unit's target tests fail before its code exists and pass once it does.
//
//   node scripts/migration/red-green.ts --base <ref> --head <ref>
//
// The unit's targets are the ledger targets that the head adds over the base. Each one must
// be red at the first commit of base..head whose tree holds it: its workspace typechecks, its
// test file loads, and the test fails, on a check rather than on a missing binding. A target
// that no commit runs fails the gate. Then every target must pass in the checked-out tree,
// which in CI is the pull request's merge commit. Commits are checked out in a disposable
// worktree outside this one; its dependencies come from the pnpm store.
// Exits 1 when a target is not red first and green last.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

import { BaselineError, repoRoot } from "./baselines.ts";

const LEDGER_DIR = "docs/migration/parity";

export interface TestResult {
  readonly status: "passed" | "failed" | "skipped";
  readonly message: string;
}

export type FailureKind = "assertion" | "missing-binding" | "other";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

// ---------------------------------------------------------------------------------------
// Targets

// Every target of every ledger row, from ledger files keyed by name.
export function ledgerTargets(
  ledgers: ReadonlyMap<string, unknown>
): Set<string> {
  const targets = new Set<string>();
  for (const data of ledgers.values())
    for (const row of asArray(isRecord(data) ? data["rows"] : undefined))
      if (isRecord(row))
        for (const target of asArray(row["targets"]))
          if (typeof target === "string") targets.add(target);
  return targets;
}

export function newTargets(
  base: ReadonlyMap<string, unknown>,
  head: ReadonlyMap<string, unknown>
): string[] {
  const before = ledgerTargets(base);
  return [...ledgerTargets(head)]
    .filter((target) => !before.has(target))
    .toSorted();
}

export function splitTarget(target: string): { file: string; title: string } {
  const at = target.indexOf("::");
  return { file: target.slice(0, at), title: target.slice(at + 2) };
}

// ---------------------------------------------------------------------------------------
// Reports

// "file::title" -> result, from a Vitest JSON report. A file that failed to load contributes
// no tests.
export function readVitestResults(
  report: unknown,
  root: string
): Map<string, TestResult> {
  const results = new Map<string, TestResult>();
  for (const file of asArray(
    isRecord(report) ? report["testResults"] : undefined
  )) {
    if (!isRecord(file) || typeof file["name"] !== "string") continue;
    const relative = path
      .relative(root, file["name"])
      .split(path.sep)
      .join("/");
    for (const test of asArray(file["assertionResults"])) {
      if (!isRecord(test) || typeof test["title"] !== "string") continue;
      const title = [...asArray(test["ancestorTitles"]), test["title"]].join(
        " > "
      );
      const status =
        test["status"] === "passed" || test["status"] === "failed"
          ? test["status"]
          : "skipped";
      const message = asArray(test["failureMessages"])
        .filter((item): item is string => typeof item === "string")
        .join("\n");
      results.set(`${relative}::${title}`, { status, message });
    }
  }
  return results;
}

// A failure that only shows the code is missing says nothing about the test's checks.
export function failureKind(message: string): FailureKind {
  const first = message.trimStart().split("\n")[0] ?? "";
  if (/^AssertionError\b/.test(first)) return "assertion";
  if (
    /^(?:ReferenceError|SyntaxError)\b/.test(first) ||
    /\bis not (?:a function|a constructor|defined|iterable)\b/.test(first) ||
    /does not provide an export/.test(first)
  )
    return "missing-binding";
  return "other";
}

export interface RedVerdict {
  readonly red: readonly string[];
  readonly problems: readonly string[];
  readonly nonAssertion: readonly string[];
}

// Why a target that a commit holds is not properly red there, or undefined when it is.
function redProblem(
  target: string,
  commit: string,
  result: TestResult | undefined,
  typecheckFailure: string | undefined
): string | undefined {
  if (typecheckFailure !== undefined)
    return `${target}: does not typecheck at ${commit}: ${typecheckFailure}`;
  if (result === undefined)
    return `${target}: is not collected at ${commit}; does its file load?`;
  if (result.status === "passed")
    return `${target}: passes at ${commit}, before its code`;
  if (result.status === "skipped") return `${target}: is skipped at ${commit}`;
  if (failureKind(result.message) === "missing-binding")
    return `${target}: fails at ${commit} on a missing binding: ${result.message.split("\n")[0]}`;
  return undefined;
}

// Judges the targets that one commit holds: each must be red there.
export function judgeRed(
  commit: string,
  targets: readonly string[],
  results: ReadonlyMap<string, TestResult>,
  typecheckFailures: ReadonlyMap<string, string>,
  workspaceOf: (file: string) => string
): RedVerdict {
  const red: string[] = [];
  const problems: string[] = [];
  const nonAssertion: string[] = [];
  for (const target of targets) {
    const result = results.get(target);
    const problem = redProblem(
      target,
      commit,
      result,
      typecheckFailures.get(workspaceOf(splitTarget(target).file))
    );
    if (problem === undefined) {
      red.push(target);
      if (failureKind(result?.message ?? "") === "other")
        nonAssertion.push(target);
    } else problems.push(problem);
  }
  return { red, problems, nonAssertion };
}

export function judgeGreen(
  targets: readonly string[],
  results: ReadonlyMap<string, TestResult>
): string[] {
  return targets.flatMap((target) => {
    const status = results.get(target)?.status;
    return status === "passed"
      ? []
      : [
          `${target}: ${status === undefined ? "does not run" : status} in the checked-out tree`,
        ];
  });
}

// ---------------------------------------------------------------------------------------
// Running

function git(args: readonly string[], cwd = repoRoot): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function readLedgersAt(ref: string): Map<string, unknown> {
  const names = git(["ls-tree", "--name-only", `${ref}:${LEDGER_DIR}`])
    .split("\n")
    .filter((name) => name.endsWith(".json"));
  return new Map(
    names.map((name) => [
      name,
      JSON.parse(git(["show", `${ref}:${LEDGER_DIR}/${name}`])),
    ])
  );
}

// The nearest directory above `file` with a package.json, relative to `root`.
function workspaceIn(root: string, file: string): string {
  let dir = path.posix.dirname(file);
  while (dir !== "." && !existsSync(path.join(root, dir, "package.json")))
    dir = path.posix.dirname(dir);
  return dir;
}

function run(
  command: string,
  args: readonly string[],
  cwd: string
): { ok: boolean; output: string } {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout}${result.stderr}`,
  };
}

// Runs the targets' test files with a JSON reporter, workspace by workspace.
function runTargets(
  root: string,
  targets: readonly string[]
): Map<string, TestResult> {
  const results = new Map<string, TestResult>();
  const byWorkspace = Map.groupBy(
    targets
      .map((target) => splitTarget(target).file)
      .filter((file) => existsSync(path.join(root, file))),
    (file) => workspaceIn(root, file)
  );
  for (const [workspace, files] of byWorkspace) {
    const scratch = mkdtempSync(path.join(tmpdir(), "red-green-"));
    const report = path.join(scratch, "report.json");
    try {
      run(
        "pnpm",
        [
          "exec",
          "vitest",
          "run",
          ...new Set(files.map((file) => path.posix.relative(workspace, file))),
          "--reporter=json",
          `--outputFile.json=${report}`,
        ],
        path.join(root, workspace)
      );
      if (existsSync(report))
        for (const [key, value] of readVitestResults(
          JSON.parse(readFileSync(report, "utf8")),
          root
        ))
          results.set(key, value);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }
  return results;
}

function typecheck(
  root: string,
  workspaces: Iterable<string>
): Map<string, string> {
  const failures = new Map<string, string>();
  for (const workspace of workspaces) {
    const result = run(
      "pnpm",
      ["exec", "tsc", "--noEmit", "-p", "tsconfig.json"],
      path.join(root, workspace)
    );
    if (!result.ok)
      failures.set(
        workspace,
        result.output.trim().split("\n")[0] ?? "tsc failed"
      );
  }
  return failures;
}

// A target is held by a commit once its test file there contains its own test title.
function holds(worktree: string, target: string): boolean {
  const { file, title } = splitTarget(target);
  const leaf = title.split(" > ").at(-1) ?? title;
  const full = path.join(worktree, file);
  return existsSync(full) && readFileSync(full, "utf8").includes(leaf);
}

// Checks each target at the first commit that holds it.
function checkCommits(
  commits: readonly string[],
  targets: readonly string[]
): RedVerdict & { readonly pending: readonly string[] } {
  const red: string[] = [];
  const problems: string[] = [];
  const nonAssertion: string[] = [];
  let pending = [...targets];
  const worktree = mkdtempSync(path.join(tmpdir(), "red-green-tree-"));
  rmSync(worktree, { recursive: true });
  git(["worktree", "add", "--detach", worktree, commits[0] ?? "HEAD"]);
  try {
    for (const commit of commits) {
      if (pending.length === 0) break;
      git(["checkout", "--quiet", "--detach", commit], worktree);
      const due = pending.filter((target) => holds(worktree, target));
      if (due.length === 0) continue;
      const install = run(
        "pnpm",
        ["install", "--frozen-lockfile", "--prefer-offline"],
        worktree
      );
      if (!install.ok)
        throw new BaselineError(
          `pnpm install failed at ${commit}:\n${install.output}`
        );
      const workspaceOf = (file: string) => workspaceIn(worktree, file);
      const verdict = judgeRed(
        commit.slice(0, 7),
        due,
        runTargets(worktree, due),
        typecheck(
          worktree,
          new Set(due.map((target) => workspaceOf(splitTarget(target).file)))
        ),
        workspaceOf
      );
      red.push(...verdict.red);
      problems.push(...verdict.problems);
      nonAssertion.push(...verdict.nonAssertion);
      pending = pending.filter((target) => !due.includes(target));
    }
  } finally {
    git(["worktree", "remove", "--force", worktree]);
  }
  return { red, problems, nonAssertion, pending };
}

function main(argv: readonly string[]): number {
  const { values } = parseArgs({
    args: [...argv],
    options: { base: { type: "string" }, head: { type: "string" } },
  });
  if (values.base === undefined || values.head === undefined)
    throw new BaselineError("usage: red-green.ts --base <ref> --head <ref>");
  const targets = newTargets(
    readLedgersAt(values.base),
    readLedgersAt(values.head)
  );
  if (targets.length === 0) {
    console.error("G8: the head adds no ledger targets");
    return 0;
  }
  const commits = git([
    "rev-list",
    "--reverse",
    "--first-parent",
    `${values.base}..${values.head}`,
  ])
    .split("\n")
    .filter((line) => line !== "");
  const red = checkCommits(commits, targets);
  const problems = [
    ...red.problems,
    ...red.pending.map((target) => `${target}: no commit of the range runs it`),
    ...judgeGreen(targets, runTargets(repoRoot, targets)),
  ];
  for (const problem of problems) console.error(problem);
  for (const target of red.nonAssertion)
    console.error(
      `note: ${target} was red on an error other than an assertion`
    );
  console.error(
    problems.length === 0
      ? `G8: ${targets.length} targets red first and green last`
      : `G8: ${problems.length} problems in ${targets.length} targets`
  );
  return problems.length === 0 ? 0 : 1;
}

if (import.meta.main) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
