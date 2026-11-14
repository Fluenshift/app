// Gate G10: a ported test keeps the strength of its source.
//
//   node scripts/migration/parity-audit.ts [--root <dir>]
//
// For every class A and class B `port` row with targets, it compares the source test (at the
// pinned baseline commit, or in migration/characterization/) with its target tests in this
// repository, by static reading of each test's body:
// - assertion count: the targets make at least as many `expect` and `assert` calls;
// - expected literals: every string, number and keyword literal passed to a source matcher is
//   passed to a target matcher too;
// - matcher strength: every source matcher has a target matcher of the same name, or, among
//   the equality matchers, one at least as strict (`toBe` and `toStrictEqual`, then `toEqual`,
//   then `toMatchObject`). Bun's `toBeTrue()` and `toBeFalse()` count as `toBe(true)` and
//   `toBe(false)`, as the mapping table allows.
// Class C rows are reported but never fail: their tests are re-expressed, not ported, and the
// report feeds the cross-vendor verification (G12). --root names the directory that holds the
// baseline clones (default: the one baselines.ts uses).
// Exits 1 when a class A or B row is weaker than its source or cannot be read.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import {
  clonePath,
  defaultRoot,
  git,
  pinFor,
  readPins,
  repoRoot,
} from "./baselines.ts";

export interface TestMetrics {
  readonly assertions: number;
  readonly matchers: readonly string[];
  readonly literals: readonly string[];
}

// ---------------------------------------------------------------------------------------
// Reading test source

// Index just past the string or template literal that starts at `start`. Braces inside a
// template's substitutions are counted, so a closing backtick there does not end it.
function skipString(text: string, start: number): number {
  const quote = text[start];
  let index = start + 1;
  let depth = 0;
  while (index < text.length) {
    const char = text[index];
    if (char === "\\") index += 2;
    else if (char === quote && depth === 0) return index + 1;
    else {
      if (quote === "`" && text.startsWith("${", index)) depth += 1;
      else if (quote === "`" && char === "}" && depth > 0) depth -= 1;
      index += 1;
    }
  }
  return index;
}

// Index just past a comment that starts at `start`, or `start` when none does.
function skipComment(text: string, start: number): number {
  if (text.startsWith("//", start)) {
    const end = text.indexOf("\n", start);
    return end === -1 ? text.length : end + 1;
  }
  if (text.startsWith("/*", start)) {
    const end = text.indexOf("*/", start + 2);
    return end === -1 ? text.length : end + 2;
  }
  return start;
}

const OPEN = new Set(["(", "[", "{"]);
const CLOSE = new Set([")", "]", "}"]);

// Index of the bracket that closes the one at `open`, skipping strings and comments.
export function closingBracket(text: string, open: number): number {
  let depth = 0;
  let index = open;
  while (index < text.length) {
    const char = text[index] ?? "";
    const afterComment = skipComment(text, index);
    if (afterComment !== index) index = afterComment;
    else if (char === '"' || char === "'" || char === "`")
      index = skipString(text, index);
    else {
      if (OPEN.has(char)) depth += 1;
      if (CLOSE.has(char)) depth -= 1;
      if (depth === 0) return index;
      index += 1;
    }
  }
  return text.length;
}

// The value of a string literal written in source, or undefined for a template with
// substitutions. Escapes JSON does not know leave the literal as written.
export function literalValue(literal: string): string | undefined {
  const [quote] = literal;
  const body = literal.slice(1, -1);
  if (quote === "`" && body.includes("${")) return undefined;
  const json = body.replaceAll(
    /\\(.)|"|\n/gsu,
    (match, escaped: string | undefined) => {
      if (escaped === undefined) return match === "\n" ? "\\n" : '\\"';
      return escaped === "'" || escaped === "`" ? escaped : match;
    }
  );
  try {
    return JSON.parse(`"${json}"`) as string;
  } catch {
    return body;
  }
}

const TEST_CALL =
  /\b(?:it|test)(?:\s*\.\s*(?:effect|scoped|live|concurrent|sequential|fails))*\s*\(\s*(?=["'`])/g;

// The bodies of the test calls whose title is `title`.
export function testBodies(text: string, title: string): string[] {
  const bodies: string[] = [];
  for (const match of text.matchAll(TEST_CALL)) {
    const titleStart = match.index + match[0].length;
    const titleEnd = skipString(text, titleStart);
    if (literalValue(text.slice(titleStart, titleEnd)) !== title) continue;
    const open = text.lastIndexOf("(", titleStart);
    bodies.push(text.slice(titleEnd, closingBracket(text, open)));
  }
  return bodies;
}

const ASSERTION = /\b(?:expect(?:\s*\.\s*soft)?|assert(?:\s*\.\s*\w+)?)\s*\(/g;
// Vitest and Bun matchers; other `to...` methods such as `toString` are not matchers.
const MATCHER =
  /\.\s*((?:not\s*\.\s*)?(?:(?:resolves|rejects)\s*\.\s*)?)(to(?:Be|Equal|StrictEqual|Match|Contain|Have|Throw|Satisfy)\w*)\s*\(/g;
const LITERAL =
  /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|(?<![\w$.])-?\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?n?\b|\b(?:true|false|null|undefined|NaN|Infinity)\b/g;

// Literals in matcher arguments, normalized: strings by value, numbers by value.
function argumentLiterals(args: string): string[] {
  return [...args.matchAll(LITERAL)].flatMap(([token]) => {
    if (/^["'`]/.test(token)) {
      const value = literalValue(token);
      return value === undefined ? [] : [JSON.stringify(value)];
    }
    if (/^-?\d/.test(token))
      return [String(Number(token.replaceAll("_", "").replace(/n$/, "")))];
    return [token];
  });
}

export function metrics(body: string): TestMetrics {
  const matchers: string[] = [];
  const literals: string[] = [];
  for (const match of body.matchAll(MATCHER)) {
    const prefix = (match[1] ?? "").replaceAll(/\s+/g, "");
    const open = match.index + match[0].length - 1;
    const args = body.slice(open + 1, closingBracket(body, open));
    const name = match[2] ?? "";
    if (name === "toBeTrue" || name === "toBeFalse") {
      matchers.push(`${prefix}toBe`);
      literals.push(name === "toBeTrue" ? "true" : "false");
    } else matchers.push(`${prefix}${name}`);
    literals.push(...argumentLiterals(args));
  }
  return {
    assertions: [...body.matchAll(ASSERTION)].length,
    matchers: matchers.toSorted(),
    literals: literals.toSorted(),
  };
}

export function combine(all: readonly TestMetrics[]): TestMetrics {
  return {
    assertions: all.reduce((sum, item) => sum + item.assertions, 0),
    matchers: all.flatMap((item) => item.matchers).toSorted(),
    literals: all.flatMap((item) => item.literals).toSorted(),
  };
}

// ---------------------------------------------------------------------------------------
// Comparing

const EQUALITY: Readonly<Record<string, number>> = {
  toBe: 3,
  toStrictEqual: 3,
  toEqual: 2,
  toMatchObject: 1,
};

function counts(items: readonly string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) map.set(item, (map.get(item) ?? 0) + 1);
  return map;
}

// A matcher name as its `not` or `resolves` prefix and, for equality matchers, its strength.
const splitMatcher = (name: string) => {
  const at = name.lastIndexOf(".") + 1;
  return { prefix: name.slice(0, at), strength: EQUALITY[name.slice(at)] };
};

const isEquality = (name: string) =>
  name.slice(name.lastIndexOf(".") + 1) in EQUALITY;

// Equality matchers: each source matcher takes the weakest unused target matcher that is at
// least as strict, with the same `not` prefix.
function equalityProblems(
  source: readonly string[],
  target: readonly string[]
): string[] {
  const available = target
    .map(splitMatcher)
    .filter((item) => item.strength !== undefined)
    .toSorted((a, b) => (a.strength ?? 0) - (b.strength ?? 0));
  const problems: string[] = [];
  const wanted = source
    .filter((name) => splitMatcher(name).strength !== undefined)
    .toSorted(
      (a, b) =>
        (splitMatcher(b).strength ?? 0) - (splitMatcher(a).strength ?? 0)
    );
  for (const name of wanted) {
    const { prefix, strength = 0 } = splitMatcher(name);
    const index = available.findIndex(
      (item) => item.prefix === prefix && (item.strength ?? 0) >= strength
    );
    if (index === -1)
      problems.push(`matcher ${name} has no equally strict target`);
    else available.splice(index, 1);
  }
  return problems;
}

export function compareMetrics(
  source: TestMetrics,
  target: TestMetrics
): string[] {
  const problems: string[] = [];
  if (target.assertions < source.assertions)
    problems.push(
      `${target.assertions} assertions where the source has ${source.assertions}`
    );
  problems.push(
    ...equalityProblems(source.matchers, target.matchers),
    ...[...counts(source.matchers.filter((name) => !isEquality(name)))].flatMap(
      ([name, count]) =>
        (counts(target.matchers).get(name) ?? 0) < count
          ? [
              `matcher ${name} appears ${count} times in the source, fewer in the targets`,
            ]
          : []
    ),
    ...[...counts(source.literals)].flatMap(([literal, count]) =>
      (counts(target.literals).get(literal) ?? 0) < count
        ? [`expected literal ${literal} is missing from the targets`]
        : []
    )
  );
  return problems;
}

// ---------------------------------------------------------------------------------------
// The audit

export interface AuditRow {
  readonly id: string;
  readonly source: string;
  readonly class: string | null;
  readonly disposition: string;
  readonly targets: readonly string[];
}

export interface AuditResult {
  readonly failures: readonly string[];
  readonly reports: readonly string[];
  readonly audited: number;
}

const splitRef = (ref: string) => {
  const at = ref.indexOf("::");
  return { file: ref.slice(0, at), title: ref.slice(at + 2) };
};

// Reads one test by file and full title; the last title segment locates it.
export function readTest(
  read: (file: string) => string | undefined,
  file: string,
  title: string
): TestMetrics | string {
  const text = read(file);
  if (text === undefined) return `${file} cannot be read`;
  const leaf = title.split(" > ").at(-1) ?? title;
  const bodies = testBodies(text, leaf);
  if (bodies.length === 0) return `"${leaf}" is not found in ${file}`;
  if (bodies.length > 1) return `"${leaf}" is ambiguous in ${file}`;
  return metrics(bodies[0] ?? "");
}

export function auditRows(
  rows: readonly AuditRow[],
  readSource: (row: AuditRow) => string | undefined,
  readTarget: (file: string) => string | undefined
): AuditResult {
  const failures: string[] = [];
  const reports: string[] = [];
  let audited = 0;
  for (const row of rows) {
    if (
      row.disposition !== "port" ||
      row.targets.length === 0 ||
      row.class === null
    )
      continue;
    audited += 1;
    const sink = row.class === "C" ? reports : failures;
    const source = readTest(
      () => readSource(row),
      row.source,
      splitRef(row.id).title
    );
    const targets = row.targets.map((target) => {
      const { file, title } = splitRef(target);
      return readTest(readTarget, file, title);
    });
    const unreadable = [source, ...targets].filter(
      (item) => typeof item === "string"
    );
    if (unreadable.length > 0) {
      sink.push(...unreadable.map((reason) => `${row.id}: ${reason}`));
      continue;
    }
    for (const problem of compareMetrics(
      source as TestMetrics,
      combine(targets as TestMetrics[])
    ))
      sink.push(`${row.id}: ${problem}`);
  }
  return { failures, reports, audited };
}

function readLedgerRows(): AuditRow[] {
  const dir = path.join(repoRoot, "docs", "migration", "parity");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .flatMap((name) => {
      const data = JSON.parse(readFileSync(path.join(dir, name), "utf8")) as {
        readonly rows: readonly AuditRow[];
      };
      return data.rows;
    });
}

function tryRead(file: string): string | undefined {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
}

function main(argv: readonly string[]): number {
  const { values } = parseArgs({
    args: [...argv],
    options: { root: { type: "string" } },
  });
  const root =
    values.root === undefined ? defaultRoot : path.resolve(values.root);
  const pins = readPins();
  const readSource = (row: AuditRow): string | undefined => {
    const [system = "", kind] = row.id.split(":");
    if (kind === "characterization")
      return tryRead(
        path.join(
          repoRoot,
          "migration",
          "characterization",
          system,
          "files",
          row.source
        )
      );
    try {
      return git(
        ["show", `${pinFor(pins, system).commit}:${row.source}`],
        clonePath(system, root)
      );
    } catch {
      return undefined;
    }
  };
  const result = auditRows(readLedgerRows(), readSource, (file) =>
    tryRead(path.join(repoRoot, file))
  );
  for (const report of result.reports)
    console.error(`report (class C): ${report}`);
  for (const failure of result.failures) console.error(failure);
  console.error(
    result.failures.length === 0
      ? `G10: ${result.audited} ported rows keep their source's strength`
      : `G10: ${result.failures.length} problems in ${result.audited} ported rows`
  );
  return result.failures.length === 0 ? 0 : 1;
}

if (import.meta.main) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
