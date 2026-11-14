// Gate G9: validates the parity ledger against the inventory and derives each row's status.
//
//   node scripts/migration/parity-check.ts [--reports <dir>] [--json <file>]
//
// The ledger stores no status; this script derives it:
// - `verified`: a `port` or `port-changed` row whose targets all pass in the reports;
// - `open`: a `port` or `port-changed` row with no target yet, or (without --reports) with
//   targets that were not checked;
// - `blocked`: a `pending-decision` row;
// - `terminal`: a `superseded`, `drop` or `informative` row.
//
// Errors (exit 1): an inventory row missing from the ledger or present twice, a ledger row
// that is not in the inventory, a malformed row, a `port-changed`, `superseded` or `drop` row
// without an accepted ADR, a target that is missing, failing or skipped outside
// `pending-decision`, and a `port` target whose title differs from its source title.
//
// --reports reads every Vitest and Playwright JSON report in the directory. Without it, only
// the ledger's structure is checked.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { repoRoot } from "./baselines.ts";

export type Disposition =
  | "port"
  | "port-changed"
  | "superseded"
  | "drop"
  | "informative"
  | "pending-decision";

export type Status = "verified" | "open" | "blocked" | "terminal";

export interface LedgerRow {
  readonly id: string;
  readonly source: string;
  readonly class: "A" | "B" | "C" | null;
  readonly slice: string;
  readonly disposition: Disposition;
  readonly decision: string | null;
  readonly targets: readonly string[];
}

export interface InventoryRow {
  readonly id: string;
  readonly kind: string;
  readonly source: string;
  readonly title: string;
}

export type TestOutcome = "passed" | "failed" | "skipped";

export interface AdrIndex {
  // Present when docs/adr exists; maps "0003" to whether that ADR is accepted.
  readonly accepted: ReadonlyMap<string, boolean> | undefined;
}

export interface Finding {
  readonly id: string;
  readonly message: string;
}

export interface CheckResult {
  readonly errors: readonly Finding[];
  readonly warnings: readonly Finding[];
  readonly statuses: ReadonlyMap<string, Status>;
}

const DISPOSITIONS = new Set<string>([
  "port",
  "port-changed",
  "superseded",
  "drop",
  "informative",
  "pending-decision",
]);
const LANES = new Set(["evaluation", "academy", "platform"]);
const CLASSES = new Set<unknown>(["A", "B", "C", null]);
const ROW_KEYS = "class,decision,disposition,id,slice,source,targets";
const TEST_KINDS = new Set(["test", "characterization"]);
const NEEDS_ACCEPTED_ADR = new Set(["port-changed", "superseded", "drop"]);
const DECISION = /^(adr:(\d{4})|issue:[1-9]\d*)$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

// ---------------------------------------------------------------------------------------
// Ledger files

function isTargetList(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every((target) => typeof target === "string" && target.includes("::"))
  );
}

function isDecision(value: unknown): boolean {
  return value === null || (typeof value === "string" && DECISION.test(value));
}

function rowProblems(row: Record<string, unknown>, slice: string): string[] {
  const checks: [boolean, string][] = [
    [typeof row["id"] === "string", "id must be a string"],
    [typeof row["source"] === "string", "source must be a string"],
    [CLASSES.has(row["class"]), "class must be A, B, C or null"],
    [row["slice"] === slice, `slice must be "${slice}"`],
    [
      typeof row["disposition"] === "string" &&
        DISPOSITIONS.has(row["disposition"]),
      "unknown disposition",
    ],
    [isDecision(row["decision"]), "decision must be null, adr:NNNN or issue:N"],
    [isTargetList(row["targets"]), "targets must be file::title strings"],
  ];
  return checks.filter(([ok]) => !ok).map(([, message]) => message);
}

// Validates one ledger file and returns its rows; structural problems become errors.
export function parseLedger(
  name: string,
  data: unknown,
  errors: Finding[]
): LedgerRow[] {
  const slice = name.replace(/\.json$/, "");
  if (!isRecord(data)) {
    errors.push({ id: name, message: "expected an object" });
    return [];
  }
  if (Object.keys(data).toSorted().join(",") !== "lane,rows,slice")
    errors.push({ id: name, message: "expected exactly lane, rows, slice" });
  if (data["slice"] !== slice)
    errors.push({ id: name, message: `slice must be "${slice}"` });
  if (typeof data["lane"] !== "string" || !LANES.has(data["lane"]))
    errors.push({
      id: name,
      message: "lane must be evaluation, academy or platform",
    });
  const valid: LedgerRow[] = [];
  for (const [index, row] of asArray(data["rows"]).entries()) {
    const where =
      isRecord(row) && typeof row["id"] === "string"
        ? row["id"]
        : `${name}[${index}]`;
    if (!isRecord(row) || Object.keys(row).toSorted().join(",") !== ROW_KEYS) {
      errors.push({
        id: where,
        message: `a row has exactly the keys ${ROW_KEYS}`,
      });
      continue;
    }
    const problems = rowProblems(row, slice);
    for (const message of problems) errors.push({ id: where, message });
    if (problems.length === 0) valid.push(row as unknown as LedgerRow);
  }
  return valid;
}

// Accepted ADRs, from the status line of each docs/adr/NNNN-*.md file.
export function readAdrIndex(adrDir: string): AdrIndex {
  if (!existsSync(adrDir)) return { accepted: undefined };
  const accepted = new Map<string, boolean>();
  for (const name of readdirSync(adrDir)) {
    const number = /^(\d{4})-.+\.md$/.exec(name)?.[1];
    if (number === undefined) continue;
    const text = readFileSync(path.join(adrDir, name), "utf8");
    accepted.set(number, /^- Status: Accepted\b/m.test(text));
  }
  return { accepted };
}

// ---------------------------------------------------------------------------------------
// Test reports

function vitestOutcome(status: unknown): TestOutcome {
  if (status === "passed") return "passed";
  if (status === "failed") return "failed";
  return "skipped";
}

function playwrightOutcome(statuses: readonly unknown[]): TestOutcome {
  if (statuses.every((status) => status === "expected")) return "passed";
  if (statuses.every((status) => status === "skipped")) return "skipped";
  return "failed";
}

function addVitestOutcomes(
  report: Record<string, unknown>,
  relative: (file: string) => string,
  outcomes: Map<string, TestOutcome>
): void {
  for (const file of asArray(report["testResults"])) {
    if (!isRecord(file) || typeof file["name"] !== "string") continue;
    for (const test of asArray(file["assertionResults"])) {
      if (!isRecord(test) || typeof test["title"] !== "string") continue;
      const title = [...asArray(test["ancestorTitles"]), test["title"]].join(
        " > "
      );
      outcomes.set(
        `${relative(file["name"])}::${title}`,
        vitestOutcome(test["status"])
      );
    }
  }
}

function addPlaywrightOutcomes(
  report: Record<string, unknown>,
  relative: (file: string) => string,
  outcomes: Map<string, TestOutcome>
): void {
  const config = isRecord(report["config"]) ? report["config"] : {};
  const rootDir =
    typeof config["rootDir"] === "string" ? relative(config["rootDir"]) : ".";
  const visit = (
    node: Record<string, unknown>,
    titles: readonly string[],
    file: string
  ): void => {
    for (const child of asArray(node["suites"]))
      if (isRecord(child) && typeof child["title"] === "string")
        visit(child, [...titles, child["title"]], file);
    for (const spec of asArray(node["specs"])) {
      if (!isRecord(spec) || typeof spec["title"] !== "string") continue;
      const statuses = asArray(spec["tests"]).map((test) =>
        isRecord(test) ? test["status"] : undefined
      );
      const key = `${path.posix.join(rootDir, file)}::${[...titles, spec["title"]].join(" > ")}`;
      outcomes.set(key, playwrightOutcome(statuses));
    }
  };
  for (const fileSuite of asArray(report["suites"]))
    if (isRecord(fileSuite) && typeof fileSuite["file"] === "string")
      visit(fileSuite, [], fileSuite["file"]);
}

// "file::title" -> outcome, from a Vitest or Playwright JSON report. Paths become
// repo-relative.
export function readTestOutcomes(
  report: unknown,
  root: string
): Map<string, TestOutcome> {
  const outcomes = new Map<string, TestOutcome>();
  if (!isRecord(report)) return outcomes;
  const relative = (file: string) =>
    path.isAbsolute(file)
      ? path.relative(root, file).split(path.sep).join("/")
      : file;
  if (Array.isArray(report["testResults"]))
    addVitestOutcomes(report, relative, outcomes);
  if (Array.isArray(report["suites"]))
    addPlaywrightOutcomes(report, relative, outcomes);
  return outcomes;
}

// ---------------------------------------------------------------------------------------
// The check

const titleOf = (id: string) => id.slice(id.indexOf("::") + 2);

function adrMessage(row: LedgerRow, adrs: AdrIndex): string {
  if (row.decision === null || !row.decision.startsWith("adr:"))
    return `${row.disposition} needs an accepted ADR as its decision`;
  if (adrs.accepted === undefined)
    return `${row.disposition} needs ${row.decision}, but docs/adr does not exist`;
  return `${row.decision} is not accepted`;
}

function checkDecision(
  row: LedgerRow,
  adrs: AdrIndex,
  errors: Finding[]
): void {
  const adrNumber = row.decision?.startsWith("adr:")
    ? row.decision.slice(4)
    : undefined;
  const accepted =
    adrNumber === undefined ? undefined : adrs.accepted?.get(adrNumber);
  if (
    adrNumber !== undefined &&
    adrs.accepted !== undefined &&
    accepted === undefined
  )
    errors.push({
      id: row.id,
      message: `decision ${row.decision} names no ADR in docs/adr`,
    });
  if (row.disposition === "pending-decision" && row.decision === null)
    errors.push({
      id: row.id,
      message: "pending-decision rows name the decision they wait for",
    });
  if (row.disposition === "port" && row.decision !== null)
    errors.push({ id: row.id, message: "a port row has no decision" });
  if (NEEDS_ACCEPTED_ADR.has(row.disposition) && accepted !== true)
    errors.push({ id: row.id, message: adrMessage(row, adrs) });
}

function targetStatus(
  row: LedgerRow,
  source: InventoryRow,
  outcomes: ReadonlyMap<string, TestOutcome> | undefined,
  errors: Finding[]
): Status {
  if (row.disposition === "port" && TEST_KINDS.has(source.kind))
    for (const target of row.targets)
      if (titleOf(target) !== source.title)
        errors.push({
          id: row.id,
          message: `target "${target}" must keep the source title "${source.title}"`,
        });
  if (row.targets.length === 0 || outcomes === undefined) return "open";
  let verified = true;
  for (const target of row.targets) {
    const outcome = outcomes.get(target);
    if (outcome === undefined)
      errors.push({
        id: row.id,
        message: `target "${target}" is not in the reports`,
      });
    if (outcome === "failed")
      errors.push({ id: row.id, message: `target "${target}" fails` });
    if (outcome === "skipped")
      errors.push({
        id: row.id,
        message: `target "${target}" is skipped; only pending-decision rows may skip`,
      });
    verified &&= outcome === "passed";
  }
  return verified ? "verified" : "open";
}

function rowStatus(
  row: LedgerRow,
  source: InventoryRow,
  outcomes: ReadonlyMap<string, TestOutcome> | undefined,
  errors: Finding[]
): Status {
  if (row.disposition === "pending-decision") return "blocked";
  if (row.disposition === "port" || row.disposition === "port-changed")
    return targetStatus(row, source, outcomes, errors);
  return "terminal";
}

export function checkLedger(
  inventory: readonly InventoryRow[],
  ledger: readonly LedgerRow[],
  adrs: AdrIndex,
  outcomes: ReadonlyMap<string, TestOutcome> | undefined
): CheckResult {
  const errors: Finding[] = [];
  const warnings: Finding[] = [];
  const statuses = new Map<string, Status>();
  const inventoryById = new Map(inventory.map((row) => [row.id, row]));
  const seen = new Map<string, number>();
  for (const row of ledger) seen.set(row.id, (seen.get(row.id) ?? 0) + 1);
  for (const row of inventory)
    if (!seen.has(row.id))
      errors.push({
        id: row.id,
        message: "inventory row missing from the ledger",
      });
  for (const [id, count] of seen)
    if (count > 1)
      errors.push({ id, message: `ledger holds this row ${count} times` });

  for (const row of ledger) {
    const source = inventoryById.get(row.id);
    if (source === undefined) {
      errors.push({
        id: row.id,
        message: "ledger row is not in the inventory",
      });
      continue;
    }
    if (row.source !== source.source)
      errors.push({ id: row.id, message: `source must be "${source.source}"` });
    if (TEST_KINDS.has(source.kind) !== (row.class !== null))
      errors.push({
        id: row.id,
        message: "test rows need a class and other rows must not have one",
      });
    checkDecision(row, adrs, errors);
    statuses.set(row.id, rowStatus(row, source, outcomes, errors));
  }
  if (
    adrs.accepted === undefined &&
    ledger.some((row) => row.decision?.startsWith("adr:"))
  )
    warnings.push({
      id: "docs/adr",
      message: "does not exist: ADR references are not resolved",
    });
  return { errors, warnings, statuses };
}

// ---------------------------------------------------------------------------------------

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, "utf8"));
}

function readInventory(inventoryDir: string): InventoryRow[] {
  return readdirSync(inventoryDir)
    .filter((name) => name.endsWith(".json") && !name.endsWith("-issues.json"))
    .flatMap((name) => {
      const data = readJson(path.join(inventoryDir, name));
      return isRecord(data) ? (asArray(data["rows"]) as InventoryRow[]) : [];
    });
}

function readOutcomes(reportsDir: string): Map<string, TestOutcome> {
  const outcomes = new Map<string, TestOutcome>();
  for (const name of readdirSync(reportsDir).filter((file) =>
    file.endsWith(".json")
  ))
    for (const [key, outcome] of readTestOutcomes(
      readJson(path.join(reportsDir, name)),
      repoRoot
    ))
      outcomes.set(key, outcome);
  return outcomes;
}

type Counts = Record<Status, number>;

function countBySlice(
  ledger: readonly LedgerRow[],
  statuses: ReadonlyMap<string, Status>
): Map<string, Counts> {
  const bySlice = new Map<string, Counts>();
  for (const row of ledger) {
    const counts = bySlice.get(row.slice) ?? {
      verified: 0,
      open: 0,
      blocked: 0,
      terminal: 0,
    };
    const status = statuses.get(row.id);
    if (status !== undefined) counts[status] += 1;
    bySlice.set(row.slice, counts);
  }
  return bySlice;
}

const describe = (counts: Counts) =>
  `${counts.verified} verified, ${counts.terminal} terminal, ${counts.open} open, ${counts.blocked} blocked`;

function main(argv: readonly string[]): number {
  const { values } = parseArgs({
    args: [...argv],
    options: { reports: { type: "string" }, json: { type: "string" } },
  });
  const inventory = readInventory(
    path.join(repoRoot, "docs", "migration", "inventory")
  );
  const parityDir = path.join(repoRoot, "docs", "migration", "parity");
  const errors: Finding[] = [];
  const ledger = readdirSync(parityDir)
    .filter((name) => name.endsWith(".json"))
    .toSorted()
    .flatMap((name) =>
      parseLedger(name, readJson(path.join(parityDir, name)), errors)
    );
  const outcomes =
    values.reports === undefined ? undefined : readOutcomes(values.reports);
  const result = checkLedger(
    inventory,
    ledger,
    readAdrIndex(path.join(repoRoot, "docs", "adr")),
    outcomes
  );
  const allErrors = [...errors, ...result.errors];

  const bySlice = countBySlice(ledger, result.statuses);
  const total: Counts = { verified: 0, open: 0, blocked: 0, terminal: 0 };
  for (const counts of bySlice.values())
    for (const status of Object.keys(total) as Status[])
      total[status] += counts[status];
  const done =
    (100 * (total.verified + total.terminal)) / Math.max(ledger.length, 1);
  const note =
    outcomes === undefined ? " (targets not checked: no --reports)" : "";
  console.error(
    `parity: ${ledger.length} rows, ${describe(total)}; ${done.toFixed(1)}% done${note}`
  );
  for (const [slice, counts] of [...bySlice.entries()].toSorted(([a], [b]) =>
    a.localeCompare(b)
  ))
    console.error(`  ${slice}: ${describe(counts)}`);
  for (const warning of result.warnings)
    console.error(`warning: ${warning.id}: ${warning.message}`);
  for (const error of allErrors)
    console.error(`error: ${error.id}: ${error.message}`);

  if (values.json !== undefined)
    writeFileSync(
      values.json,
      `${JSON.stringify(
        {
          total,
          slices: Object.fromEntries(bySlice),
          statuses: Object.fromEntries(result.statuses),
          errors: allErrors,
          warnings: result.warnings,
        },
        null,
        2
      )}\n`
    );
  return allErrors.length === 0 ? 0 : 1;
}

if (import.meta.main) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
