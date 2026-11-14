// Gate G11: the gates stay at least as strict as gates/baseline.json.
//
//   node scripts/check-gates.ts            compare the tree with gates/baseline.json
//   node scripts/check-gates.ts --write    record the tree as gates/baseline.json
//
// Only the coordinator records a baseline (agent rule 13), and recording a weaker one needs an
// accepted ADR (agent rule 15). The comparison covers:
// - lint: what `oxlint --print-config` resolves for each lint configuration. No rule loses
//   severity or changes its options, no override relaxes a rule, no plugin is dropped and no
//   ignore pattern is added;
// - TypeScript: the effective strictness options of every tsconfig, the Effect diagnostic
//   severities and the allowed unstable Effect APIs;
// - scripts: the gate scripts of every package.json, verbatim;
// - workflows: every trigger and `run` command stays, and no `if` or `continue-on-error` line
//   is added;
// - the pre-commit hooks and the formatter, Vite, Vitest and Playwright configurations: the
//   same lines, none removed and none added;
// - suppression comments: no file gains one.
// Exits 1 when anything is weaker than the baseline.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { BaselineError, repoRoot } from "./migration/baselines.ts";

export const baselineFile = path.join(repoRoot, "gates", "baseline.json");

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export interface LintOverride {
  readonly files: Json;
  readonly plugins: readonly string[];
  readonly rules: Readonly<Record<string, Json>>;
}

export interface LintSnapshot {
  readonly plugins: readonly string[];
  readonly categories: Readonly<Record<string, Json>>;
  readonly rules: Readonly<Record<string, Json>>;
  readonly overrides: readonly LintOverride[];
  readonly ignorePatterns: readonly string[];
}

export interface EffectSnapshot {
  readonly severities: Readonly<Record<string, string>>;
  readonly allowedUnstableApis: readonly string[];
}

export interface TypeScriptSnapshot {
  readonly options: Readonly<Record<string, boolean | null>>;
  readonly effect: EffectSnapshot | null;
}

export interface WorkflowSnapshot {
  readonly triggers: readonly string[];
  readonly run: readonly string[];
  readonly conditions: readonly string[];
}

export interface Snapshot {
  readonly lint: Readonly<Record<string, LintSnapshot>>;
  readonly typescript: Readonly<Record<string, TypeScriptSnapshot>>;
  readonly scripts: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly workflows: Readonly<Record<string, WorkflowSnapshot>>;
  readonly lines: Readonly<Record<string, readonly string[]>>;
  readonly suppressions: Readonly<
    Record<string, Readonly<Record<string, number>>>
  >;
}

// ---------------------------------------------------------------------------------------------
// Lint

const LINT_SEVERITY: Readonly<Record<string, number>> = {
  allow: 0,
  off: 0,
  warn: 1,
  deny: 2,
  error: 2,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

// Plain data with sorted keys: a recorded baseline diffs cleanly, and rule options compare
// whatever their key order.
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .toSorted()
      .map((key) => [key, sortKeys(value[key])])
  );
}

// A rule as `oxlint --print-config` prints it: a severity, or [severity, ...options].
export function ruleSetting(value: Json | undefined): {
  severity: number;
  options: string;
} {
  if (value === undefined) return { severity: 0, options: "[]" };
  const [level, ...options] = Array.isArray(value) ? value : [value];
  const severity =
    typeof level === "number" ? level : (LINT_SEVERITY[String(level)] ?? 0);
  return { severity, options: JSON.stringify(sortKeys(options)) };
}

export function lintSnapshot(printed: unknown): LintSnapshot {
  if (!isRecord(printed) || !isRecord(printed["rules"]))
    throw new BaselineError("oxlint --print-config: unexpected output");
  const overrides = Array.isArray(printed["overrides"])
    ? printed["overrides"]
    : [];
  return {
    plugins: strings(printed["plugins"]).toSorted(),
    categories: (isRecord(printed["categories"])
      ? printed["categories"]
      : {}) as Record<string, Json>,
    rules: printed["rules"] as Record<string, Json>,
    overrides: overrides.filter(isRecord).map((override) => ({
      files: (override["files"] ?? null) as Json,
      plugins: strings(override["plugins"]).toSorted(),
      rules: (isRecord(override["rules"]) ? override["rules"] : {}) as Record<
        string,
        Json
      >,
    })),
    ignorePatterns: strings(printed["ignorePatterns"]).toSorted(),
  };
}

function compareRules(
  where: string,
  baseline: Readonly<Record<string, Json>>,
  current: Readonly<Record<string, Json>>
): string[] {
  const problems: string[] = [];
  for (const [rule, value] of Object.entries(baseline)) {
    const before = ruleSetting(value);
    const after = ruleSetting(current[rule]);
    if (after.severity < before.severity)
      problems.push(`${where}: rule ${rule} is weaker than the baseline`);
    else if (before.severity > 0 && after.options !== before.options)
      problems.push(`${where}: rule ${rule} changed its options`);
  }
  return problems;
}

// An override may tighten rules freely. It may relax a rule only as far as the baseline's same
// override already did.
function compareOverride(
  where: string,
  rootRules: Readonly<Record<string, Json>>,
  baseline: LintOverride | undefined,
  current: LintOverride
): string[] {
  const problems: string[] = [];
  for (const [rule, value] of Object.entries(current.rules)) {
    if (baseline !== undefined && rule in baseline.rules) continue;
    if (ruleSetting(value).severity < ruleSetting(rootRules[rule]).severity)
      problems.push(`${where}: a new override relaxes rule ${rule}`);
  }
  if (baseline === undefined) return problems;
  for (const plugin of baseline.plugins)
    if (!current.plugins.includes(plugin))
      problems.push(`${where}: plugin ${plugin} left the override`);
  for (const [rule, value] of Object.entries(baseline.rules)) {
    const before = ruleSetting(value);
    if (!(rule in current.rules)) {
      if (before.severity > 0)
        problems.push(`${where}: rule ${rule} left the override`);
      continue;
    }
    problems.push(...compareRules(where, { [rule]: value }, current.rules));
  }
  return problems;
}

const overrideKey = (override: LintOverride) => JSON.stringify(override.files);

export function compareLint(
  file: string,
  baseline: LintSnapshot,
  current: LintSnapshot
): string[] {
  const problems = compareRules(file, baseline.rules, current.rules);
  for (const plugin of baseline.plugins)
    if (!current.plugins.includes(plugin))
      problems.push(`${file}: plugin ${plugin} was dropped`);
  for (const pattern of current.ignorePatterns)
    if (!baseline.ignorePatterns.includes(pattern))
      problems.push(`${file}: ignore pattern ${pattern} was added`);
  for (const [category, value] of Object.entries(baseline.categories))
    if (
      ruleSetting(current.categories[category]).severity <
      ruleSetting(value).severity
    )
      problems.push(
        `${file}: category ${category} is weaker than the baseline`
      );
  const before = new Map(baseline.overrides.map((o) => [overrideKey(o), o]));
  const after = new Map(current.overrides.map((o) => [overrideKey(o), o]));
  for (const [files, override] of before)
    if (!after.has(files))
      for (const [rule, value] of Object.entries(override.rules))
        if (ruleSetting(value).severity > 0)
          problems.push(
            `${file}: the override for ${files} was removed with rule ${rule}`
          );
  for (const [files, override] of after)
    problems.push(
      ...compareOverride(
        `${file} override ${files}`,
        baseline.rules,
        before.get(files),
        override
      )
    );
  return problems;
}

// ---------------------------------------------------------------------------------------------
// TypeScript

// Options where `true` is the stricter value. An unset member of the `strict` family follows
// `strict`.
const STRICT_WHEN_TRUE = [
  "alwaysStrict",
  "erasableSyntaxOnly",
  "exactOptionalPropertyTypes",
  "forceConsistentCasingInFileNames",
  "isolatedModules",
  "noFallthroughCasesInSwitch",
  "noImplicitAny",
  "noImplicitOverride",
  "noImplicitReturns",
  "noImplicitThis",
  "noPropertyAccessFromIndexSignature",
  "noUncheckedIndexedAccess",
  "noUncheckedSideEffectImports",
  "noUnusedLocals",
  "noUnusedParameters",
  "strict",
  "strictBindCallApply",
  "strictBuiltinIteratorReturn",
  "strictFunctionTypes",
  "strictNullChecks",
  "strictPropertyInitialization",
  "useUnknownInCatchVariables",
  "verbatimModuleSyntax",
];
const STRICT_FAMILY = new Set([
  "alwaysStrict",
  "noImplicitAny",
  "noImplicitThis",
  "strictBindCallApply",
  "strictBuiltinIteratorReturn",
  "strictFunctionTypes",
  "strictNullChecks",
  "strictPropertyInitialization",
  "useUnknownInCatchVariables",
]);
// Options where `false` is the stricter value; unset sits between.
const STRICT_WHEN_FALSE = [
  "allowUnreachableCode",
  "allowUnusedLabels",
  "skipLibCheck",
];
const EFFECT_PLUGIN = "@effect/language-service";
const EFFECT_SEVERITY: Readonly<Record<string, number>> = {
  off: 0,
  suggestion: 1,
  message: 2,
  warning: 3,
  error: 4,
};

function strictness(option: string, value: boolean | null): number {
  if (!STRICT_WHEN_FALSE.includes(option)) return value === true ? 1 : 0;
  if (value === false) return 2;
  return value === null ? 1 : 0;
}

// The compiler options of a tsconfig after its `extends` chain, plus the Effect plugin.
export function effectiveOptions(
  file: string,
  readConfig: (file: string) => unknown,
  resolveExtends: (from: string, specifier: string) => string,
  seen: ReadonlySet<string> = new Set()
): Record<string, unknown> {
  if (seen.has(file))
    throw new BaselineError(`${file}: circular tsconfig extends`);
  const config = readConfig(file);
  if (!isRecord(config)) throw new BaselineError(`${file}: not a JSON object`);
  const own = isRecord(config["compilerOptions"])
    ? config["compilerOptions"]
    : {};
  const parent =
    typeof config["extends"] === "string"
      ? effectiveOptions(
          resolveExtends(file, config["extends"]),
          readConfig,
          resolveExtends,
          new Set([...seen, file])
        )
      : {};
  return { ...parent, ...own };
}

export function typeScriptSnapshot(
  options: Readonly<Record<string, unknown>>
): TypeScriptSnapshot {
  const value = (option: string): boolean | null => {
    const set = options[option];
    if (typeof set === "boolean") return set;
    if (STRICT_FAMILY.has(option) && options["strict"] === true) return true;
    return null;
  };
  const plugin = (
    Array.isArray(options["plugins"]) ? options["plugins"] : []
  ).find((entry) => isRecord(entry) && entry["name"] === EFFECT_PLUGIN);
  return {
    options: Object.fromEntries(
      [...STRICT_WHEN_TRUE, ...STRICT_WHEN_FALSE]
        .toSorted()
        .map((option) => [option, value(option)])
    ),
    effect: isRecord(plugin)
      ? {
          severities: Object.fromEntries(
            Object.entries(
              isRecord(plugin["diagnosticSeverity"])
                ? plugin["diagnosticSeverity"]
                : {}
            ).map(([rule, severity]) => [rule, String(severity)])
          ),
          allowedUnstableApis: strings(
            plugin["allowedUnstableApis"]
          ).toSorted(),
        }
      : null,
  };
}

export function compareTypeScript(
  file: string,
  baseline: TypeScriptSnapshot,
  current: TypeScriptSnapshot
): string[] {
  const problems: string[] = [];
  for (const [option, value] of Object.entries(baseline.options))
    if (
      strictness(option, current.options[option] ?? null) <
      strictness(option, value)
    )
      problems.push(`${file}: compiler option ${option} is weaker`);
  if (baseline.effect === null) return problems;
  if (current.effect === null)
    return [...problems, `${file}: the ${EFFECT_PLUGIN} plugin is gone`];
  for (const [rule, severity] of Object.entries(baseline.effect.severities)) {
    const after = current.effect.severities[rule];
    if (
      after === undefined ||
      (EFFECT_SEVERITY[after] ?? 0) < (EFFECT_SEVERITY[severity] ?? 0)
    )
      problems.push(`${file}: Effect diagnostic ${rule} is weaker`);
  }
  for (const api of current.effect.allowedUnstableApis)
    if (!baseline.effect.allowedUnstableApis.includes(api))
      problems.push(`${file}: unstable Effect API ${api} was allowed`);
  return problems;
}

// ---------------------------------------------------------------------------------------------
// Scripts, workflows, files, suppressions

export const GATE_SCRIPTS = [
  "build",
  "check-types",
  "check:docs",
  "check:effect",
  "check:gates",
  "format",
  "lint",
  "lint:effect",
  "parity",
  "prepare",
  "test",
  "test:e2e",
  "test:scripts",
  "verify",
];

export function gateScripts(packageJson: unknown): Record<string, string> {
  const scripts =
    isRecord(packageJson) && isRecord(packageJson["scripts"])
      ? packageJson["scripts"]
      : {};
  return Object.fromEntries(
    GATE_SCRIPTS.flatMap((name) =>
      typeof scripts[name] === "string" ? [[name, scripts[name]]] : []
    )
  );
}

export function compareScripts(
  file: string,
  baseline: Readonly<Record<string, string>>,
  current: Readonly<Record<string, string>>
): string[] {
  return Object.entries(baseline).flatMap(([name, command]) =>
    current[name] === command
      ? []
      : [`${file}: script ${name} changed or was removed`]
  );
}

const squash = (text: string) => text.trim().replaceAll(/\s+/g, " ");

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

// The lines indented under `line`, for a YAML block scalar or mapping.
function blockAfter(lines: readonly string[], index: number): string[] {
  const parent = indentOf(lines[index] ?? "");
  const block: string[] = [];
  for (const line of lines.slice(index + 1)) {
    if (line.trim() === "") continue;
    if (indentOf(line) <= parent) break;
    block.push(line);
  }
  return block;
}

// Reads the gate-relevant lines of a workflow: the `on` triggers, every `run` command (block
// scalars joined) and every `if` or `continue-on-error` line.
export function workflowSnapshot(text: string): WorkflowSnapshot {
  const lines = text.split("\n");
  const triggers = new Set<string>();
  const run = new Set<string>();
  const conditions = new Set<string>();
  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) continue;
    if (line.startsWith("on:")) {
      const inline = squash(line.slice(3));
      if (inline !== "") triggers.add(inline);
      for (const entry of blockAfter(lines, index)) triggers.add(squash(entry));
    }
    const command = /^(?:- )?run:\s*(.*)$/.exec(trimmed);
    if (command !== null) {
      const rest = command[1] ?? "";
      run.add(
        /^[>|][+-]?$/.test(rest)
          ? squash(blockAfter(lines, index).join(" "))
          : squash(rest)
      );
    }
    if (/^(?:- )?(?:if|continue-on-error):/.test(trimmed))
      conditions.add(squash(trimmed.replace(/^- /, "")));
  }
  return {
    triggers: [...triggers].toSorted(),
    run: [...run].toSorted(),
    conditions: [...conditions].toSorted(),
  };
}

export function compareWorkflow(
  file: string,
  baseline: WorkflowSnapshot,
  current: WorkflowSnapshot
): string[] {
  return [
    ...baseline.triggers
      .filter((trigger) => !current.triggers.includes(trigger))
      .map((trigger) => `${file}: trigger "${trigger}" was removed`),
    ...baseline.run
      .filter((command) => !current.run.includes(command))
      .map((command) => `${file}: run "${command}" was removed or changed`),
    ...current.conditions
      .filter((condition) => !baseline.conditions.includes(condition))
      .map((condition) => `${file}: "${condition}" was added`),
  ];
}

// Every line that is neither blank nor a comment, trimmed, sorted.
export function significantLines(text: string): string[] {
  return [
    ...new Set(
      text
        .split("\n")
        .map((line) => line.trim())
        .filter(
          (line) =>
            line !== "" &&
            !line.startsWith("//") &&
            !line.startsWith("#") &&
            !line.startsWith("/*") &&
            !line.startsWith("*")
        )
    ),
  ].toSorted();
}

export function compareLines(
  file: string,
  baseline: readonly string[],
  current: readonly string[]
): string[] {
  return [
    ...baseline
      .filter((line) => !current.includes(line))
      .map((line) => `${file}: line "${line}" was removed or changed`),
    ...current
      .filter((line) => !baseline.includes(line))
      .map((line) => `${file}: line "${line}" was added`),
  ];
}

const COMMENT = String.raw`(?:\/\/|\/\*)\s*`;
const SUPPRESSIONS: readonly (readonly [string, RegExp])[] = [
  ["lint-disable", new RegExp(`${COMMENT}(?:oxlint|eslint)-disable`, "g")],
  ["ts-expect-error", new RegExp(`${COMMENT}@ts-expect-error`, "g")],
  ["ts-ignore", new RegExp(`${COMMENT}@ts-ignore`, "g")],
  ["ts-nocheck", new RegExp(`${COMMENT}@ts-nocheck`, "g")],
  ["effect-diagnostics", new RegExp(`${COMMENT}@effect-diagnostics`, "g")],
];

export function countSuppressions(text: string): Record<string, number> {
  return Object.fromEntries(
    SUPPRESSIONS.flatMap(([kind, pattern]) => {
      const count = [...text.matchAll(pattern)].length;
      return count === 0 ? [] : [[kind, count]];
    })
  );
}

export function compareSuppressions(
  baseline: Snapshot["suppressions"],
  current: Snapshot["suppressions"]
): string[] {
  return Object.entries(current).flatMap(([file, counts]) =>
    Object.entries(counts).flatMap(([kind, count]) =>
      count > (baseline[file]?.[kind] ?? 0)
        ? [`${file}: ${kind} suppressions rose to ${count}`]
        : []
    )
  );
}

// ---------------------------------------------------------------------------------------------
// The whole comparison

function compareEach<T>(
  what: string,
  baseline: Readonly<Record<string, T>>,
  current: Readonly<Record<string, T>>,
  compareOne: (file: string, baseline: T, current: T) => string[]
): string[] {
  return Object.entries(baseline).flatMap(([file, before]) => {
    const after = current[file];
    return after === undefined
      ? [`${file}: ${what} is missing`]
      : compareOne(file, before, after);
  });
}

// The reference for a tsconfig the baseline does not know yet.
export const REFERENCE_TSCONFIG = "packages/config/tsconfig.base.json";

export function compare(baseline: Snapshot, current: Snapshot): string[] {
  const reference = baseline.typescript[REFERENCE_TSCONFIG];
  const newTsconfigs = Object.entries(current.typescript).flatMap(
    ([file, snapshot]) =>
      file in baseline.typescript || reference === undefined
        ? []
        : compareTypeScript(file, reference, snapshot)
  );
  const newConfigs = Object.keys(current.lines)
    .filter((file) => !(file in baseline.lines))
    .map((file) => `${file}: a new configuration the baseline does not hold`);
  return [
    ...compareEach(
      "lint configuration",
      baseline.lint,
      current.lint,
      compareLint
    ),
    ...compareEach(
      "tsconfig",
      baseline.typescript,
      current.typescript,
      compareTypeScript
    ),
    ...newTsconfigs,
    ...compareEach(
      "package.json",
      baseline.scripts,
      current.scripts,
      compareScripts
    ),
    ...compareEach(
      "workflow",
      baseline.workflows,
      current.workflows,
      compareWorkflow
    ),
    ...compareEach("file", baseline.lines, current.lines, compareLines),
    ...newConfigs,
    ...compareSuppressions(baseline.suppressions, current.suppressions),
  ];
}

// ---------------------------------------------------------------------------------------------
// Reading the tree

const LINT_CONFIG =
  /^(?:\.oxlintrc\.jsonc?|oxlint(?:\.[\w-]+)?\.config\.[cm]?[jt]s)$/;
const TSCONFIG = /(?:^|\/)tsconfig(?:\.[\w-]+)?\.json$/;
const WORKFLOW = /^\.github\/workflows\/[^/]+\.ya?ml$/;
const LINE_FILES = [
  /^\.husky\/[^/_][^/]*$/,
  /^oxfmt(?:\.[\w-]+)?\.config\.[cm]?[jt]s$/,
  /(?:^|\/)(?:vite|vitest|playwright)(?:\.[\w-]+)?\.config\.[cm]?[jt]s$/,
];
const CODE = /\.[cm]?[jt]sx?$/;
// Characterization tests are written for the baselines and never run here.
const NOT_OURS = /^migration\//;

function trackedFiles(root: string): string[] {
  return execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter((file) => file !== "");
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new BaselineError(`${file}: not valid JSON (${String(error)})`);
  }
}

// Workspace packages by name, so `extends: "@scope/pkg/file.json"` resolves without node_modules.
function workspacePackages(
  root: string,
  files: readonly string[]
): Map<string, string> {
  const packages = new Map<string, string>();
  for (const file of files.filter((f) => f.endsWith("package.json"))) {
    const manifest = readJson(path.join(root, file));
    if (isRecord(manifest) && typeof manifest["name"] === "string")
      packages.set(manifest["name"], path.dirname(file));
  }
  return packages;
}

function resolverFor(root: string, packages: ReadonlyMap<string, string>) {
  return (from: string, specifier: string): string => {
    if (specifier.startsWith("."))
      return path.join(path.dirname(from), specifier);
    for (const [name, dir] of packages)
      if (specifier.startsWith(`${name}/`))
        return path.join(root, dir, specifier.slice(name.length + 1));
    throw new BaselineError(`${from}: cannot resolve extends ${specifier}`);
  };
}

function printLintConfig(root: string, config: string): unknown {
  const output = execFileSync(
    path.join(root, "node_modules", ".bin", "oxlint"),
    ["--config", config, "--print-config"],
    { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  return JSON.parse(output);
}

export function snapshotTree(root: string): Snapshot {
  const files = trackedFiles(root).filter((file) => !NOT_OURS.test(file));
  const read = (file: string) => readFileSync(path.join(root, file), "utf8");
  const resolve = resolverFor(root, workspacePackages(root, files));
  const ofKind = (pattern: RegExp) =>
    files.filter((file) => pattern.test(file));
  return {
    lint: Object.fromEntries(
      ofKind(LINT_CONFIG).map((file) => [
        file,
        lintSnapshot(printLintConfig(root, file)),
      ])
    ),
    typescript: Object.fromEntries(
      ofKind(TSCONFIG).map((file) => [
        file,
        typeScriptSnapshot(
          effectiveOptions(path.join(root, file), readJson, resolve)
        ),
      ])
    ),
    scripts: Object.fromEntries(
      files
        .filter((file) => file.endsWith("package.json"))
        .map((file) => [file, gateScripts(readJson(path.join(root, file)))])
    ),
    workflows: Object.fromEntries(
      ofKind(WORKFLOW).map((file) => [file, workflowSnapshot(read(file))])
    ),
    lines: Object.fromEntries(
      files
        .filter((file) => LINE_FILES.some((pattern) => pattern.test(file)))
        .map((file) => [file, significantLines(read(file))])
    ),
    suppressions: Object.fromEntries(
      ofKind(CODE).flatMap((file) => {
        const counts = countSuppressions(read(file));
        return Object.keys(counts).length === 0 ? [] : [[file, counts]];
      })
    ),
  };
}

function main(argv: readonly string[]): number {
  const { values } = parseArgs({
    args: [...argv],
    options: { write: { type: "boolean", default: false } },
  });
  const current = snapshotTree(repoRoot);
  if (values.write) {
    writeFileSync(
      baselineFile,
      `${JSON.stringify(sortKeys(current), null, 2)}\n`
    );
    execFileSync(
      path.join(repoRoot, "node_modules", ".bin", "oxfmt"),
      [baselineFile],
      {
        cwd: repoRoot,
        stdio: "ignore",
      }
    );
    console.log(`${path.relative(repoRoot, baselineFile)}: recorded`);
    return 0;
  }
  const problems = compare(readJson(baselineFile) as Snapshot, current);
  for (const problem of problems) console.error(problem);
  console.error(
    problems.length === 0
      ? "G11: every gate is as strict as gates/baseline.json"
      : `G11: ${problems.length} weaker than gates/baseline.json`
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
