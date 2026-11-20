// Resolves a merge conflict in a ledger file (docs/migration/parity/<slice>.json): the union of
// both sides' rows by id, with the union of their targets. A row whose disposition or decision
// differs between the sides is refused, since only an ADR changes those. Run during a merge or a
// rebase, from the repository root:
//
//   node scripts/migration/ledger-union.ts docs/migration/parity/<slice>.json...
//
// Each file is read from the index stages 2 (ours) and 3 (theirs), written back, and staged.

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

import { BaselineError, repoRoot } from "./baselines.ts";
import { naturalCompare } from "./inventory.ts";

export interface LedgerFile {
  readonly lane: string;
  readonly rows: readonly UnionRow[];
  readonly slice: string;
}

export interface UnionRow {
  readonly decision: string | null;
  readonly disposition: string;
  readonly id: string;
  readonly targets: readonly string[];
  readonly [field: string]: unknown;
}

/** Both sides' rows by id, sorted as the inventory sorts them, with the union of targets. */
export function unionLedgers(ours: LedgerFile, theirs: LedgerFile): LedgerFile {
  const rows = new Map(ours.rows.map((row) => [row.id, row]));
  for (const row of theirs.rows) {
    const mine = rows.get(row.id);
    if (mine === undefined) {
      rows.set(row.id, row);
      continue;
    }
    if (
      mine.disposition !== row.disposition ||
      mine.decision !== row.decision
    ) {
      throw new BaselineError(
        `${row.id} differs in disposition or decision between the sides`
      );
    }
    rows.set(row.id, {
      ...mine,
      targets: [...new Set([...mine.targets, ...row.targets])],
    });
  }
  return {
    ...ours,
    rows: [...rows.values()].toSorted((a, b) => naturalCompare(a.id, b.id)),
  };
}

const stage = (index: number, file: string): LedgerFile =>
  JSON.parse(
    execFileSync("git", ["show", `:${String(index)}:${file}`], {
      cwd: repoRoot,
      encoding: "utf8",
    })
  ) as LedgerFile;

function main(files: readonly string[]): void {
  if (files.length === 0) {
    throw new BaselineError(
      "usage: node scripts/migration/ledger-union.ts docs/migration/parity/<slice>.json..."
    );
  }
  for (const file of files) {
    const merged = unionLedgers(stage(2, file), stage(3, file));
    writeFileSync(
      path.join(repoRoot, file),
      `${JSON.stringify(merged, null, 2)}\n`
    );
    execFileSync("git", ["add", file], { cwd: repoRoot });
    console.log(`${file}: ${String(merged.rows.length)} rows`);
  }
}

if (import.meta.main) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
