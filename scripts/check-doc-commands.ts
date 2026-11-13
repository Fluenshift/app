// Keeps documented commands real: every `pnpm <script>` named in README.md or AGENTS.md must
// be a script of the root package.json, and every `node scripts/<file>` named there or in
// docs/ must exist.
//
//   node scripts/check-doc-commands.ts

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const PNPM_BUILTINS = new Set([
  "add",
  "approve",
  "audit",
  "dlx",
  "exec",
  "i",
  "install",
  "list",
  "outdated",
  "remove",
  "run",
  "store",
  "update",
  "why",
]);

export interface DocProblem {
  readonly file: string;
  readonly line: number;
  readonly message: string;
}

// Code spans and fenced code blocks only: prose may name commands of other repositories.
export function codeLines(markdown: string): { text: string; line: number }[] {
  const lines: { text: string; line: number }[] = [];
  let fenced = false;
  for (const [index, text] of markdown.split("\n").entries()) {
    if (/^\s*(```|~~~)/.test(text)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) lines.push({ text, line: index + 1 });
    else
      for (const span of text.matchAll(/`([^`]+)`/g))
        lines.push({ text: span[1] ?? "", line: index + 1 });
  }
  return lines;
}

export function checkMarkdown(
  file: string,
  markdown: string,
  scripts: ReadonlySet<string>,
  exists: (relative: string) => boolean,
  checkPnpm: boolean
): DocProblem[] {
  const problems: DocProblem[] = [];
  for (const { text, line } of codeLines(markdown)) {
    if (checkPnpm)
      for (const match of text.matchAll(
        /(?:^|[\s;&|(])pnpm\s+([a-z][\w:-]*)/g
      )) {
        const name = match[1] ?? "";
        if (!PNPM_BUILTINS.has(name) && !scripts.has(name))
          problems.push({
            file,
            line,
            message: `pnpm ${name} is not a root script`,
          });
      }
    for (const match of text.matchAll(
      /(?:^|[\s;&|(])node\s+(scripts\/[\w./-]+)/g
    )) {
      const script = match[1] ?? "";
      if (!exists(script))
        problems.push({ file, line, message: `${script} does not exist` });
    }
  }
  return problems;
}

function markdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

function main(): number {
  const root = path.resolve(import.meta.dirname, "..");
  const { scripts } = JSON.parse(
    readFileSync(path.join(root, "package.json"), "utf8")
  ) as {
    readonly scripts: Readonly<Record<string, string>>;
  };
  const scriptNames = new Set(Object.keys(scripts));
  const exists = (relative: string) => existsSync(path.join(root, relative));
  const rootDocs = ["README.md", "AGENTS.md"]
    .map((name) => path.join(root, name))
    .filter(existsSync);
  const problems = [
    ...rootDocs,
    ...markdownFiles(path.join(root, "docs")),
  ].flatMap((file) =>
    checkMarkdown(
      path.relative(root, file),
      readFileSync(file, "utf8"),
      scriptNames,
      exists,
      rootDocs.includes(file)
    )
  );
  for (const problem of problems)
    console.error(`${problem.file}:${problem.line}: ${problem.message}`);
  return problems.length === 0 ? 0 : 1;
}

if (import.meta.main) process.exitCode = main();
