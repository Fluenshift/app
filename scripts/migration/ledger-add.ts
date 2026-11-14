// Adds ledger rows for inventory rows that have none yet, for example the cases of a new
// characterization suite. Existing rows are never touched.
//
//   node scripts/migration/ledger-add.ts --slice <slice> [--class A|B|C] <id-prefix>...
//
// Every inventory row whose id starts with one of the prefixes, and that no ledger file
// holds, joins docs/migration/parity/<slice>.json as a `port` row with no targets.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { BaselineError, repoRoot } from "./baselines.ts";
import { naturalCompare } from "./inventory.ts";

interface LedgerRow {
  readonly id: string;
  readonly source: string;
  readonly class: string | null;
  readonly slice: string;
  readonly disposition: string;
  readonly decision: string | null;
  readonly targets: readonly string[];
}

interface Ledger {
  readonly slice: string;
  readonly lane: string;
  readonly rows: readonly LedgerRow[];
}

interface InventoryRow {
  readonly id: string;
  readonly kind: string;
  readonly source: string;
}

const TEST_KINDS = new Set(["test", "characterization"]);

// The rows to add: inventory rows matching a prefix and absent from `known`.
export function missingRows(
  inventory: readonly InventoryRow[],
  known: ReadonlySet<string>,
  prefixes: readonly string[],
  slice: string,
  testClass: string | null
): LedgerRow[] {
  return inventory
    .filter(
      (row) =>
        !known.has(row.id) &&
        prefixes.some((prefix) => row.id.startsWith(prefix))
    )
    .map((row) => {
      if (TEST_KINDS.has(row.kind) !== (testClass !== null))
        throw new BaselineError(
          `${row.id}: test rows need --class and other rows must not have one`
        );
      return {
        id: row.id,
        source: row.source,
        class: testClass,
        slice,
        disposition: "port",
        decision: null,
        targets: [],
      };
    });
}

function main(argv: readonly string[]): void {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: { slice: { type: "string" }, class: { type: "string" } },
  });
  const { slice } = values;
  const testClass = values.class ?? null;
  if (slice === undefined || positionals.length === 0)
    throw new BaselineError(
      "usage: ledger-add.ts --slice <slice> [--class A|B|C] <id-prefix>..."
    );
  if (testClass !== null && !["A", "B", "C"].includes(testClass))
    throw new BaselineError("--class must be A, B or C");

  const inventoryDir = path.join(repoRoot, "docs", "migration", "inventory");
  const parityDir = path.join(repoRoot, "docs", "migration", "parity");
  const file = path.join(parityDir, `${slice}.json`);
  if (!existsSync(file))
    throw new BaselineError(`${path.relative(repoRoot, file)} does not exist`);

  const known = new Set<string>();
  for (const name of readdirSync(parityDir)) {
    const ledger = JSON.parse(
      readFileSync(path.join(parityDir, name), "utf8")
    ) as Ledger;
    for (const row of ledger.rows) known.add(row.id);
  }
  const inventory = readdirSync(inventoryDir)
    .filter((name) => !name.endsWith("-issues.json"))
    .flatMap(
      (name) =>
        (
          JSON.parse(readFileSync(path.join(inventoryDir, name), "utf8")) as {
            readonly rows: readonly InventoryRow[];
          }
        ).rows
    );

  const added = missingRows(inventory, known, positionals, slice, testClass);
  if (added.length === 0)
    throw new BaselineError("no inventory row without a ledger row matches");
  const ledger = JSON.parse(readFileSync(file, "utf8")) as Ledger;
  const rows = [...ledger.rows, ...added].toSorted((left, right) =>
    naturalCompare(left.id, right.id)
  );
  writeFileSync(file, `${JSON.stringify({ ...ledger, rows }, null, 2)}\n`);
  console.error(`${slice}: added ${added.length} rows`);
}

if (import.meta.main) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
