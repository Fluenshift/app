// Writes the targets of ledger rows, and only their targets: a text replacement would rewrite a
// row's id too, since each id holds its source title (AGENTS.md, Work units, step 6).
//
//   node scripts/migration/ledger-targets.ts --slice <slice> --source <source file>
//     --target <test file> [--target <test file>]... --report <vitest.json> [--report ...]
//     [--title <source title>]... [--as <target title>]
//
// Each selected row of the slice (every row of the source, or only the named titles) gets one
// target per --target file, `<file>::<title>`, under its source title or, for a single
// `port-changed` row, the title --as gives. Every target must have passed in one of the Vitest
// JSON reports, as `pnpm exec vitest run --reporter=json --outputFile=<file>` writes them;
// nothing is written otherwise.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { BaselineError, repoRoot } from "./baselines.ts";
import { readTestOutcomes } from "./parity-check.ts";

interface TargetRow {
  readonly disposition: string;
  readonly id: string;
  readonly source: string;
  readonly targets: readonly string[];
  readonly [field: string]: unknown;
}

export interface TargetRequest {
  readonly as?: string;
  readonly source: string;
  readonly targets: readonly string[];
  readonly titles: readonly string[];
}

const titleOf = (id: string) => id.slice(id.indexOf("::") + 2);

/**
 * The rows with their new targets. Refuses a selection that matches no row or misses a named
 * title, a renamed target for anything but one `port-changed` row, and any target that did not
 * pass.
 */
export function withTargets<Row extends TargetRow>(
  rows: readonly Row[],
  request: TargetRequest,
  passed: ReadonlySet<string>
): Row[] {
  const selected = rows.filter(
    (row) =>
      row.source === request.source &&
      (request.titles.length === 0 || request.titles.includes(titleOf(row.id)))
  );
  if (selected.length === 0) {
    throw new BaselineError(`no row of ${request.source} matches`);
  }
  if (
    request.titles.length > 0 &&
    selected.length !== new Set(request.titles).size
  ) {
    throw new BaselineError(
      `${String(selected.length)} rows match ${String(request.titles.length)} titles`
    );
  }
  const [only] = selected;
  if (
    request.as !== undefined &&
    (selected.length !== 1 || only?.disposition !== "port-changed")
  ) {
    throw new BaselineError("--as renames the target of one port-changed row");
  }
  const updates = new Map(
    selected.map((row) => {
      const title = request.as ?? titleOf(row.id);
      const targets = request.targets.map((file) => `${file}::${title}`);
      const missing = targets.filter((target) => !passed.has(target));
      if (missing.length > 0) {
        throw new BaselineError(
          `not passed in the reports:\n${missing.join("\n")}`
        );
      }
      return [row.id, targets] as const;
    })
  );
  return rows.map((row) => {
    const targets = updates.get(row.id);
    return targets === undefined ? row : { ...row, targets };
  });
}

/** The "file::title" of every test that passed in the reports. */
export function passedTests(
  reports: readonly unknown[],
  root: string
): Set<string> {
  const passed = new Set<string>();
  for (const report of reports) {
    for (const [test, outcome] of readTestOutcomes(report, root)) {
      if (outcome === "passed") passed.add(test);
    }
  }
  return passed;
}

function main(argv: readonly string[]): void {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      as: { type: "string" },
      report: { multiple: true, type: "string" },
      slice: { type: "string" },
      source: { type: "string" },
      target: { multiple: true, type: "string" },
      title: { multiple: true, type: "string" },
    },
  });
  const { as, report = [], slice, source, target = [], title = [] } = values;
  if (
    slice === undefined ||
    source === undefined ||
    target.length === 0 ||
    report.length === 0
  ) {
    throw new BaselineError(
      "usage: node scripts/migration/ledger-targets.ts --slice <slice> --source <file> --target <test file>... --report <vitest.json>... [--title <title>]... [--as <title>]"
    );
  }
  const file = path.join(repoRoot, "docs/migration/parity", `${slice}.json`);
  const ledger = JSON.parse(readFileSync(file, "utf8")) as {
    readonly rows: readonly TargetRow[];
  };
  const passed = passedTests(
    report.map((reportFile) => JSON.parse(readFileSync(reportFile, "utf8"))),
    repoRoot
  );
  const rows = withTargets(
    ledger.rows,
    {
      source,
      targets: target,
      titles: title,
      ...(as === undefined ? {} : { as }),
    },
    passed
  );
  writeFileSync(file, `${JSON.stringify({ ...ledger, rows }, null, 2)}\n`);
  console.error(`${slice}: wrote the targets of ${source}`);
}

if (import.meta.main) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
