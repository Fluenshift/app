// Gate G7: no route reads user text from a URL (docs/adr/0008). Loggers record URLs, so a URL
// carries only identifiers that hold nothing a Learner wrote.
//
//   node scripts/check-url-text.ts
//
// It reads the server's sources under apps/server/src, tests and test helpers excepted, and
// fails when one:
// - reads a query key or a path parameter other than the identifiers below, or one it does not
//   name with a literal;
// - reads the whole query string or every path parameter;
// - names another path parameter in a route path;
// - reads search parameters, or validates the query string or the path parameters, which reads
//   them whole.
// Exits 1 on any finding.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { repoRoot } from "./migration/baselines.ts";

/** The query keys a URL may carry: a Progress period, an insight and an Error Category. */
export const QUERY_KEYS: ReadonlySet<string> = new Set([
  "category",
  "insight",
  "period",
]);

/** The path parameters a URL may carry: the ID of an Evaluation. */
export const PATH_PARAMETERS: ReadonlySet<string> = new Set(["evaluationId"]);

export interface Finding {
  readonly file: string;
  readonly line: number;
  readonly reason: string;
}

const READ = /\breq\s*\.\s*(query|queries|param)\s*\(\s*([^)]*?)\s*\)/gu;
const LITERAL = /^(["'`])([\w-]*)\1$/u;
const ROUTE_PATH = /(["'`])(\/[^"'`\n]*)\1/gu;
const PATH_PARAMETER = /\/:(\w+)/gu;
const SEARCH = /\b(?:searchParams|URLSearchParams)\b/gu;
const VALIDATOR = /\bvalidator\s*\(\s*(["'`])(query|param)\1/gu;

function readReason(method: string, argument: string): string | undefined {
  const query = method !== "param";
  const what = query ? "query key" : "path parameter";
  if (argument === "")
    return query
      ? "reads the whole query string"
      : "reads every path parameter";
  const name = LITERAL.exec(argument)?.[2];
  if (name === undefined) return `reads a ${what} it does not name`;
  const allowed = query ? QUERY_KEYS : PATH_PARAMETERS;
  return allowed.has(name) ? undefined : `reads the ${what} "${name}"`;
}

/** Every read of a URL in `source` that may carry user text, in source order. */
export function findUrlText(file: string, source: string): Finding[] {
  const found: { readonly index: number; readonly reason: string }[] = [];
  for (const match of source.matchAll(READ)) {
    const reason = readReason(match[1] ?? "", match[2] ?? "");
    if (reason !== undefined) found.push({ index: match.index, reason });
  }
  for (const match of source.matchAll(ROUTE_PATH))
    for (const parameter of (match[2] ?? "").matchAll(PATH_PARAMETER))
      if (!PATH_PARAMETERS.has(parameter[1] ?? ""))
        found.push({
          index: match.index,
          reason: `names the path parameter "${parameter[1]}"`,
        });
  for (const match of source.matchAll(SEARCH))
    found.push({ index: match.index, reason: "reads search parameters" });
  for (const match of source.matchAll(VALIDATOR))
    found.push({
      index: match.index,
      reason:
        match[2] === "query"
          ? "validates the query string"
          : "validates the path parameters",
    });
  return found
    .toSorted((left, right) => left.index - right.index)
    .map(({ index, reason }) => ({
      file,
      line: source.slice(0, index).split("\n").length,
      reason,
    }));
}

/** The server's source files, tests and test helpers excepted. */
export function serverSources(root: string): string[] {
  const directory = path.join(root, "apps", "server", "src");
  return readdirSync(directory, { encoding: "utf8", recursive: true })
    .filter(
      (file) =>
        file.endsWith(".ts") &&
        !file.endsWith(".test.ts") &&
        !file.split(path.sep).includes("test")
    )
    .toSorted()
    .map((file) => path.join(directory, file));
}

function main(): number {
  const findings = serverSources(repoRoot).flatMap((file) =>
    findUrlText(path.relative(repoRoot, file), readFileSync(file, "utf8"))
  );
  for (const finding of findings)
    console.error(`${finding.file}:${finding.line}: ${finding.reason}`);
  console.error(
    findings.length === 0
      ? "G7: no route reads user text from a URL"
      : `G7: ${findings.length} ${findings.length === 1 ? "read" : "reads"} of a URL may carry user text (docs/adr/0008)`
  );
  return findings.length === 0 ? 0 : 1;
}

if (import.meta.main) process.exitCode = main();
