// Generates the Phase 0 inventory: one row per source test case and per normative clause,
// written to docs/migration/inventory/<system>.json.
//
//   node scripts/migration/inventory.ts [system...] [--root <dir>] [--check]
//
// Inputs, and nothing else, so the output is reproducible byte for byte:
// - the pinned commit, read from the clone that baselines.ts maintains (git objects only, not
//   the working tree);
// - the stored reports and manifest in docs/migration/baseline-runs/<system>/;
// - for Grifando, the issue snapshot in docs/migration/inventory/grifando-issues.json.
//
// --check regenerates in memory and exits 1 if any stored file differs.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import {
  BaselineError,
  clonePath,
  defaultRoot,
  git,
  pinFor,
  readPins,
  repoRoot,
} from "./baselines.ts";
import type { Pin } from "./baselines.ts";

type Baseline = "green" | "baseline-red" | "skipped" | "todo";

interface TestRow {
  readonly id: string;
  readonly kind: "test";
  readonly source: string;
  readonly title: string;
  readonly suite: string;
  readonly baseline: Baseline;
}

interface ClauseRow {
  readonly id: string;
  readonly kind:
    | "requirement"
    | "doc-rule"
    | "spec-section"
    | "doc-bullet"
    | "smoke-check";
  readonly source: string;
  readonly title: string;
  readonly line: number;
  readonly text: string;
}

interface FixCommitRow {
  readonly id: string;
  readonly kind: "fix-commit";
  readonly source: "git";
  readonly title: string;
  readonly commit: string;
  readonly pullRequest: number | null;
  readonly files: readonly string[];
}

interface IssueRow {
  readonly id: string;
  readonly kind: "issue";
  readonly source: "github";
  readonly title: string;
  readonly number: number;
  readonly state: string;
  readonly labels: readonly string[];
}

type Row = TestRow | ClauseRow | FixCommitRow | IssueRow;

interface Inventory {
  readonly system: string;
  readonly repository: string;
  readonly commit: string;
  readonly rows: readonly Row[];
}

const runsDir = path.join(repoRoot, "docs", "migration", "baseline-runs");
const inventoryDir = path.join(repoRoot, "docs", "migration", "inventory");
const TITLE_SEPARATOR = " > ";

// ---------------------------------------------------------------------------------------
// Small helpers

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown, where: string): Record<string, unknown> {
  if (!isRecord(value)) throw new BaselineError(`${where}: expected an object`);
  return value;
}

function asArray(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value))
    throw new BaselineError(`${where}: expected an array`);
  return value;
}

function asString(value: unknown, where: string): string {
  if (typeof value !== "string")
    throw new BaselineError(`${where}: expected a string`);
  return value;
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replaceAll(/[̀-ͯ]/g, "")
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}

function ordinal(index: number): string {
  return String(index + 1).padStart(2, "0");
}

// Compares digit runs numerically and everything else by UTF-16 code units, so the order
// never depends on the locale.
export function naturalCompare(left: string, right: string): number {
  const a = left.match(/\d+|\D+/g) ?? [];
  const b = right.match(/\d+|\D+/g) ?? [];
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    const x = a[index] ?? "";
    const y = b[index] ?? "";
    if (x === y) continue;
    const numeric = /^\d/.test(x) && /^\d/.test(y);
    if (numeric && Number(x) !== Number(y))
      return Number(x) < Number(y) ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return a.length - b.length;
}

function readAtPin(clone: string, pin: Pin, file: string): string {
  return git(["show", `${pin.commit}:${file}`], clone);
}

// ---------------------------------------------------------------------------------------
// Test reports

interface ManifestSuite {
  readonly id: string;
  readonly cwd: string;
  readonly runner: string;
  readonly report: string;
}

function readManifest(system: string, pin: Pin): ManifestSuite[] {
  const file = path.join(runsDir, system, "manifest.json");
  const manifest = asRecord(JSON.parse(readFileSync(file, "utf8")), file);
  if (manifest["commit"] !== pin.commit) {
    throw new BaselineError(
      `${file}: reports are for ${String(manifest["commit"])}, but the pin is ${pin.commit}`
    );
  }
  return asArray(manifest["suites"], `${file} suites`).map((entry, index) => {
    const suite = asRecord(entry, `${file} suites[${index}]`);
    return {
      id: asString(suite["id"], `${file} suites[${index}].id`),
      cwd: asString(suite["cwd"], `${file} suites[${index}].cwd`),
      runner: asString(suite["runner"], `${file} suites[${index}].runner`),
      report: asString(suite["report"], `${file} suites[${index}].report`),
    };
  });
}

function testRow(
  system: string,
  suite: string,
  file: string,
  titles: readonly string[],
  baseline: Baseline
): TestRow {
  const title = titles.join(TITLE_SEPARATOR);
  return {
    id: `${system}:test:${file}::${title}`,
    kind: "test",
    source: file,
    title,
    suite,
    baseline,
  };
}

function unescapeXml(text: string): string {
  return text.replaceAll(
    /&(#x[0-9a-fA-F]+|#[0-9]+|quot|apos|lt|gt|amp);/g,
    (_, entity: string) => {
      if (entity.startsWith("#x"))
        return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
      if (entity.startsWith("#"))
        return String.fromCodePoint(Number(entity.slice(1)));
      return { quot: '"', apos: "'", lt: "<", gt: ">", amp: "&" }[entity] ?? "";
    }
  );
}

function xmlAttributes(source: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const match of source.matchAll(/([A-Za-z_:][\w:.-]*)="([^"]*)"/g)) {
    attributes.set(match[1] ?? "", unescapeXml(match[2] ?? ""));
  }
  return attributes;
}

// bun's junit: one top-level <testsuite> per file, a nested <testsuite> per describe, and
// <testcase> elements that hold <failure>, <error> or <skipped> children when not green.
export function bunJunitTests(
  xml: string,
  system: string,
  suite: ManifestSuite
): TestRow[] {
  const rows: TestRow[] = [];
  const frames: { readonly describe: string | null }[] = [];
  let open: { file: string; titles: string[]; baseline: Baseline } | undefined;
  const tag =
    /<(\/?)(testsuite|testcase|failure|error|skipped)\b([^>]*?)(\/?)>/g;
  for (const match of xml.matchAll(tag)) {
    const [, closing, name, rawAttributes = "", selfClosing] = match;
    if (name === "testsuite") {
      if (closing === "/") frames.pop();
      else if (selfClosing !== "/") {
        const suiteName = xmlAttributes(rawAttributes).get("name") ?? "";
        frames.push({ describe: frames.length === 0 ? null : suiteName });
      }
      continue;
    }
    if (name === "testcase") {
      if (closing === "/") {
        if (open !== undefined)
          rows.push(
            testRow(system, suite.id, open.file, open.titles, open.baseline)
          );
        open = undefined;
        continue;
      }
      const attributes = xmlAttributes(rawAttributes);
      const describes = frames.flatMap(({ describe }) =>
        describe === null ? [] : [describe]
      );
      const current = {
        file: path.posix.join(suite.cwd, attributes.get("file") ?? ""),
        titles: [...describes, attributes.get("name") ?? ""],
        baseline: "green" as Baseline,
      };
      if (selfClosing === "/")
        rows.push(
          testRow(
            system,
            suite.id,
            current.file,
            current.titles,
            current.baseline
          )
        );
      else open = current;
      continue;
    }
    if (open !== undefined && closing !== "/")
      open.baseline = name === "skipped" ? "skipped" : "baseline-red";
  }
  if (frames.length !== 0 || open !== undefined)
    throw new BaselineError(`${system}/${suite.report}: unbalanced junit`);
  return rows;
}

const VITEST_STATUS: Readonly<Record<string, Baseline>> = {
  passed: "green",
  failed: "baseline-red",
  skipped: "skipped",
  pending: "skipped",
  todo: "todo",
};

export function vitestTests(
  report: unknown,
  system: string,
  suite: ManifestSuite
): TestRow[] {
  const where = `${system}/${suite.report}`;
  const rows: TestRow[] = [];
  for (const [fileIndex, entry] of asArray(
    asRecord(report, where)["testResults"],
    `${where} testResults`
  ).entries()) {
    const fileResult = asRecord(entry, `${where} testResults[${fileIndex}]`);
    const file = asString(
      fileResult["name"],
      `${where} testResults[${fileIndex}].name`
    );
    if (path.isAbsolute(file))
      throw new BaselineError(
        `${where}: ${file} is absolute; the report is not normalized`
      );
    for (const [index, assertion] of asArray(
      fileResult["assertionResults"],
      `${where} assertionResults`
    ).entries()) {
      const result = asRecord(assertion, `${where} ${file}[${index}]`);
      const status = asString(
        result["status"],
        `${where} ${file}[${index}].status`
      );
      const baseline = VITEST_STATUS[status];
      if (baseline === undefined)
        throw new BaselineError(`${where}: unknown status "${status}"`);
      const ancestors = asArray(
        result["ancestorTitles"],
        `${where} ancestorTitles`
      ).map((title) => asString(title, `${where} ancestorTitles`));
      rows.push(
        testRow(
          system,
          suite.id,
          file,
          [...ancestors, asString(result["title"], `${where} title`)],
          baseline
        )
      );
    }
  }
  return rows;
}

export function playwrightTests(
  report: unknown,
  system: string,
  suite: ManifestSuite
): TestRow[] {
  const where = `${system}/${suite.report}`;
  const root = asRecord(report, where);
  const rootDir = asString(
    asRecord(root["config"], `${where} config`)["rootDir"],
    `${where} config.rootDir`
  );
  if (path.isAbsolute(rootDir))
    throw new BaselineError(
      `${where}: rootDir is absolute; the report is not normalized`
    );
  const rows: TestRow[] = [];
  const visit = (
    node: Record<string, unknown>,
    titles: readonly string[],
    file: string
  ): void => {
    for (const child of asArray(node["suites"] ?? [], `${where} suites`)) {
      const describe = asRecord(child, `${where} suite`);
      visit(
        describe,
        [...titles, asString(describe["title"], `${where} suite.title`)],
        file
      );
    }
    for (const entry of asArray(node["specs"] ?? [], `${where} specs`)) {
      const spec = asRecord(entry, `${where} spec`);
      const statuses = asArray(spec["tests"], `${where} spec.tests`).map(
        (test) =>
          asString(
            asRecord(test, `${where} test`)["status"],
            `${where} test.status`
          )
      );
      let baseline: Baseline;
      if (statuses.every((status) => status === "expected")) baseline = "green";
      else if (statuses.every((status) => status === "skipped"))
        baseline = "skipped";
      else if (statuses.some((status) => status === "unexpected"))
        baseline = "baseline-red";
      else
        throw new BaselineError(
          `${where}: unsupported test statuses ${statuses.join(", ")}`
        );
      const title = asString(spec["title"], `${where} spec.title`);
      rows.push(
        testRow(
          system,
          suite.id,
          path.posix.join(rootDir, file),
          [...titles, title],
          baseline
        )
      );
    }
  };
  for (const entry of asArray(root["suites"], `${where} suites`)) {
    const fileSuite = asRecord(entry, `${where} file suite`);
    visit(
      fileSuite,
      [],
      asString(fileSuite["file"], `${where} file suite.file`)
    );
  }
  return rows;
}

function testRows(system: string, pin: Pin): TestRow[] {
  return readManifest(system, pin).flatMap((suite) => {
    const text = readFileSync(path.join(runsDir, system, suite.report), "utf8");
    switch (suite.runner) {
      case "bun-junit":
        return bunJunitTests(text, system, suite);
      case "vitest-json":
        return vitestTests(JSON.parse(text), system, suite);
      case "playwright-json":
        return playwrightTests(JSON.parse(text), system, suite);
      default:
        throw new BaselineError(
          `${system}/${suite.id}: unknown runner "${suite.runner}"`
        );
    }
  });
}

// ---------------------------------------------------------------------------------------
// Markdown clauses

interface Section {
  readonly headings: readonly string[];
  readonly heading: string;
  readonly level: number;
  readonly line: number;
  readonly body: readonly { readonly text: string; readonly line: number }[];
}

export function markdownSections(markdown: string): Section[] {
  const sections: Section[] = [];
  const stack: string[] = [];
  let current: {
    headings: string[];
    heading: string;
    level: number;
    line: number;
    body: { text: string; line: number }[];
  } = {
    headings: [],
    heading: "",
    level: 0,
    line: 1,
    body: [],
  };
  let fenced = false;
  for (const [index, text] of markdown.split("\n").entries()) {
    if (/^\s*(```|~~~)/.test(text)) fenced = !fenced;
    const heading = fenced ? null : /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(text);
    if (heading === null) {
      current.body.push({ text, line: index + 1 });
      continue;
    }
    sections.push(current);
    const level = (heading[1] ?? "").length;
    stack.length = level - 1;
    stack[level - 1] = heading[2] ?? "";
    current = {
      headings: stack.filter((entry) => entry !== undefined),
      heading: heading[2] ?? "",
      level,
      line: index + 1,
      body: [],
    };
  }
  sections.push(current);
  return sections.filter(
    (section) =>
      section.level > 0 || section.body.some(({ text }) => text.trim() !== "")
  );
}

interface Block {
  readonly kind: "paragraph" | "item" | "row" | "code";
  readonly text: string;
  readonly line: number;
}

const LIST_ITEM = /^([-*+]|\d+\.)\s+(.*)$/;

// Splits a section body into clauses: each paragraph, top-level list item (with its
// continuation lines and nested items), table data row, and fenced code block.
export function markdownBlocks(section: Section): Block[] {
  const blocks: Block[] = [];
  let pending:
    | { kind: "paragraph" | "item"; parts: string[]; line: number }
    | undefined;
  const flush = () => {
    if (pending !== undefined)
      blocks.push({
        kind: pending.kind,
        text: pending.parts.join(" "),
        line: pending.line,
      });
    pending = undefined;
  };
  const lines = section.body;
  for (let index = 0; index < lines.length; index += 1) {
    const { text, line } = lines[index] ?? { text: "", line: 0 };
    if (/^\s*(```|~~~)/.test(text)) {
      flush();
      const code: string[] = [];
      index += 1;
      while (
        index < lines.length &&
        !/^\s*(```|~~~)/.test(lines[index]?.text ?? "")
      ) {
        code.push(lines[index]?.text ?? "");
        index += 1;
      }
      blocks.push({ kind: "code", text: code.join("\n"), line });
      continue;
    }
    if (text.trim() === "") {
      flush();
      continue;
    }
    if (text.startsWith("|")) {
      flush();
      const next = lines[index + 1]?.text ?? "";
      const isHeader = /^\|\s*:?-{3,}/.test(next);
      const isSeparator = /^\|\s*:?-{3,}/.test(text);
      if (!isHeader && !isSeparator) {
        const cells = text
          .replace(/^\|/, "")
          .replace(/\|\s*$/, "")
          .split("|")
          .map((cell) => cell.trim());
        blocks.push({ kind: "row", text: cells.join(" | "), line });
      }
      continue;
    }
    const item = LIST_ITEM.exec(text);
    if (item !== null) {
      flush();
      pending = { kind: "item", parts: [(item[2] ?? "").trim()], line };
      continue;
    }
    const content = text.replace(/^>\s?/, "").trim();
    if (pending === undefined)
      pending = { kind: "paragraph", parts: [content], line };
    else pending.parts.push(content);
  }
  flush();
  return blocks;
}

function clauseRow(
  id: string,
  kind: ClauseRow["kind"],
  source: string,
  title: string,
  line: number,
  text: string
): ClauseRow {
  return { id, kind, source, title, line, text };
}

// Every paragraph, list item, table row and code block of a policy document is one clause.
function documentRules(
  system: string,
  key: string,
  source: string,
  markdown: string
): ClauseRow[] {
  return markdownSections(markdown).flatMap((section) =>
    markdownBlocks(section).map((block, index) =>
      clauseRow(
        `${system}:${key}:${slug(section.heading) || "preamble"}:${ordinal(index)}`,
        "doc-rule",
        source,
        section.headings.join(TITLE_SEPARATOR),
        block.line,
        block.text
      )
    )
  );
}

function sectionBody(section: Section): string {
  const lines = section.body.map(({ text }) => text.trimEnd());
  while (lines.length > 0 && lines[0] === "") lines.shift();
  while (lines.length > 0 && lines.at(-1) === "") lines.pop();
  return lines.join("\n");
}

// ---------------------------------------------------------------------------------------
// Prompt Evolution

function peRequirements(markdown: string): ClauseRow[] {
  const source = "docs/product/REQUIREMENTS.md";
  return markdownSections(markdown).flatMap((section) =>
    markdownBlocks(section).flatMap((block) => {
      if (block.kind !== "row") return [];
      const [id, ...rest] = block.text.split(" | ");
      if (id === undefined || !/^(FR|QR)-\d{2}$/.test(id)) return [];
      return [
        clauseRow(
          `pe:requirement:${id}`,
          "requirement",
          source,
          id,
          block.line,
          rest.join(" | ")
        ),
      ];
    })
  );
}

// Returns the index just past the parenthesis that closes the one at `open`, skipping
// string and template literals.
function closingParenthesis(source: string, open: number): number {
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"' || char === "'" || char === "`") {
      index += 1;
      while (index < source.length && source[index] !== char)
        index += source[index] === "\\" ? 2 : 1;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  throw new BaselineError(`unbalanced parenthesis at offset ${open}`);
}

// Every assertion in docker-smoke's main(), plus the shell checks it runs inside the
// container, titled by the report() phase they belong to.
export function peDockerSmokeChecks(source: string): ClauseRow[] {
  const file = "scripts/docker-smoke.ts";
  const start = source.indexOf("const main = async () =>");
  if (start === -1) throw new BaselineError(`${file}: main() not found`);
  const lineOf = (offset: number) => source.slice(0, offset).split("\n").length;
  const phases = [...source.matchAll(/report\(\s*"([^"]+)"\s*\)/g)].map(
    (match) => ({
      offset: match.index,
      text: match[1] ?? "",
    })
  );
  const rows: ClauseRow[] = [];
  const calls =
    /(?<=^[ \t]*(?:await[ \t]+)?)(assert(?:\.[A-Za-z]+|[A-Z][A-Za-z]*)|compose)\(/gm;
  for (const match of source.slice(start).matchAll(calls)) {
    const offset = start + match.index;
    const open = offset + (match[1] ?? "").length;
    const call = source
      .slice(offset, closingParenthesis(source, open))
      .replaceAll(/\s+/g, " ")
      .replaceAll(/\( | \)/g, (s) => s.trim());
    if (match[1] === "compose" && !/"sh", "-c"/.test(call)) continue;
    const phase =
      phases.findLast((entry) => entry.offset < offset)?.text ?? "main";
    rows.push(
      clauseRow(
        `pe:docker-smoke:L${lineOf(offset)}`,
        "smoke-check",
        file,
        phase,
        lineOf(offset),
        call
      )
    );
  }
  return rows;
}

function peRows(clone: string, pin: Pin): Row[] {
  return [
    ...peRequirements(readAtPin(clone, pin, "docs/product/REQUIREMENTS.md")),
    ...documentRules(
      "pe",
      "rubric",
      "docs/product/RUBRIC.md",
      readAtPin(clone, pin, "docs/product/RUBRIC.md")
    ),
    ...documentRules(
      "pe",
      "data-policy",
      "docs/product/DATA-POLICY.md",
      readAtPin(clone, pin, "docs/product/DATA-POLICY.md")
    ),
    ...peDockerSmokeChecks(readAtPin(clone, pin, "scripts/docker-smoke.ts")),
  ];
}

// ---------------------------------------------------------------------------------------
// Grifando

function grifandoSpec(markdown: string): ClauseRow[] {
  return markdownSections(markdown)
    .filter((section) => section.level === 2 || section.level === 3)
    .map((section) => {
      const numbered = /^(\d+(?:\.\d+)*)\.?\s/.exec(section.heading);
      const key = numbered?.[1] ?? slug(section.heading);
      return clauseRow(
        `grifando:spec:${key}`,
        "spec-section",
        "SPEC.md",
        section.heading,
        section.line,
        sectionBody(section)
      );
    });
}

const CLAUDE_SECTIONS: readonly (readonly [prefix: string, key: string])[] = [
  ["Architecture rules", "architecture-rules"],
  ["Public deployment model", "public-deployment-model"],
];

function grifandoClaudeBullets(markdown: string): ClauseRow[] {
  const sections = markdownSections(markdown);
  return CLAUDE_SECTIONS.flatMap(([prefix, key]) => {
    const section = sections.find(
      (entry) => entry.level === 2 && entry.heading.startsWith(prefix)
    );
    if (section === undefined)
      throw new BaselineError(`CLAUDE.md: section "${prefix}" not found`);
    return markdownBlocks(section)
      .filter((block) => block.kind === "item")
      .map((block, index) =>
        clauseRow(
          `grifando:claude-md:${key}:${ordinal(index)}`,
          "doc-bullet",
          "CLAUDE.md",
          section.heading,
          block.line,
          block.text
        )
      );
  });
}

function grifandoDeploySmoke(markdown: string): ClauseRow[] {
  const section = markdownSections(markdown).find(
    (entry) => entry.level === 2 && entry.heading.startsWith("5.")
  );
  if (section === undefined)
    throw new BaselineError("docs/deploy.md: section 5 not found");
  return markdownBlocks(section)
    .filter((block) => block.kind === "item")
    .map((block, index) =>
      clauseRow(
        `grifando:deploy-smoke:${ordinal(index)}`,
        "smoke-check",
        "docs/deploy.md",
        section.heading,
        block.line,
        block.text.replace(/^\[[ xX]\]\s*/, "")
      )
    );
}

const FIX_SUBJECT = /^fix(\([^)]*\))?!?:/;
const FIX_BRANCH_MERGE =
  /^Merge pull request #(\d+) from [^/\s]+\/(?:fix|hotfix|bugfix)\//;

// Bug-fix commits: every non-merge commit with a conventional "fix" subject, plus every
// non-merge commit brought in by a merged fix/, hotfix/ or bugfix/ branch.
function grifandoFixCommits(clone: string, pin: Pin): FixCommitRow[] {
  const log = git(["log", "--format=%H%x00%P%x00%s", pin.commit], clone);
  const pullRequests = new Map<string, number>();
  const fixes = new Set<string>();
  for (const line of log.split("\n")) {
    const [commit = "", parents = "", subject = ""] = line.split("\0");
    const parentList = parents.split(" ").filter(Boolean);
    if (parentList.length > 1) {
      const merge = FIX_BRANCH_MERGE.exec(subject);
      if (merge === null) continue;
      const branchCommits = git(
        ["rev-list", "--no-merges", `${parentList[0]}..${parentList[1]}`],
        clone
      );
      for (const branchCommit of branchCommits.split("\n").filter(Boolean)) {
        fixes.add(branchCommit);
        pullRequests.set(branchCommit, Number(merge[1]));
      }
    } else if (FIX_SUBJECT.test(subject)) {
      fixes.add(commit);
    }
  }
  return [...fixes].map((commit) => {
    const subject = git(["log", "-1", "--format=%s", commit], clone);
    const files = git(
      ["show", "--no-renames", "--format=", "--name-only", commit],
      clone
    )
      .split("\n")
      .filter(Boolean)
      .toSorted();
    return {
      id: `grifando:fix-commit:${commit.slice(0, 7)}`,
      kind: "fix-commit",
      source: "git",
      title: subject,
      commit,
      pullRequest: pullRequests.get(commit) ?? null,
      files,
    };
  });
}

function grifandoIssues(): IssueRow[] {
  const file = path.join(inventoryDir, "grifando-issues.json");
  return asArray(JSON.parse(readFileSync(file, "utf8")), file).map(
    (entry, index) => {
      const issue = asRecord(entry, `${file}[${index}]`);
      const { number } = issue;
      if (typeof number !== "number")
        throw new BaselineError(`${file}[${index}].number: expected a number`);
      return {
        id: `grifando:issue:${number}`,
        kind: "issue",
        source: "github",
        title: asString(issue["title"], `${file}[${index}].title`),
        number,
        state: asString(issue["state"], `${file}[${index}].state`),
        labels: asArray(issue["labels"], `${file}[${index}].labels`).map(
          (label) => asString(label, `${file} label`)
        ),
      };
    }
  );
}

function grifandoRows(clone: string, pin: Pin): Row[] {
  return [
    ...grifandoSpec(readAtPin(clone, pin, "SPEC.md")),
    ...grifandoClaudeBullets(readAtPin(clone, pin, "CLAUDE.md")),
    ...grifandoDeploySmoke(readAtPin(clone, pin, "docs/deploy.md")),
    ...grifandoFixCommits(clone, pin),
    ...grifandoIssues(),
  ];
}

// ---------------------------------------------------------------------------------------

const SOURCES: Readonly<Record<string, (clone: string, pin: Pin) => Row[]>> = {
  pe: peRows,
  grifando: grifandoRows,
};

export function buildInventory(
  system: string,
  pin: Pin,
  root = defaultRoot
): Inventory {
  const documents = SOURCES[system];
  if (documents === undefined)
    throw new BaselineError(`no inventory sources for "${system}"`);
  const clone = clonePath(system, root);
  if (!existsSync(clone))
    throw new BaselineError(`${clone} is missing; run baselines.ts sync first`);
  git(["cat-file", "-e", `${pin.commit}^{commit}`], clone);
  const rows = [...testRows(system, pin), ...documents(clone, pin)];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id))
      throw new BaselineError(`${system}: duplicate inventory id ${row.id}`);
    seen.add(row.id);
  }
  rows.sort((left, right) => naturalCompare(left.id, right.id));
  return { system, repository: pin.repository, commit: pin.commit, rows };
}

export function serialize(inventory: Inventory): string {
  return `${JSON.stringify(inventory, null, 2)}\n`;
}

function main(argv: readonly string[]): number {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      root: { type: "string" },
      check: { type: "boolean", default: false },
    },
  });
  const root =
    values.root === undefined ? defaultRoot : path.resolve(values.root);
  const pins = readPins();
  const systems = positionals.length === 0 ? [...pins.keys()] : positionals;
  let differs = false;
  for (const system of systems) {
    const file = path.join(inventoryDir, `${system}.json`);
    const output = serialize(
      buildInventory(system, pinFor(pins, system), root)
    );
    const relative = path.relative(repoRoot, file);
    if (values.check) {
      const stored = existsSync(file) ? readFileSync(file, "utf8") : "";
      if (stored === output) {
        console.error(`${relative}: reproduced byte for byte`);
      } else {
        differs = true;
        console.error(`${relative}: differs from a fresh generation`);
      }
    } else {
      writeFileSync(file, output);
      const count = JSON.parse(output).rows.length as number;
      console.error(`${relative}: ${count} rows`);
    }
  }
  return differs ? 1 : 0;
}

if (import.meta.main) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
