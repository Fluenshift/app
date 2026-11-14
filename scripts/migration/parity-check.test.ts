import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { checkLedger, parseLedger, readTestOutcomes } from "./parity-check.ts";
import type {
  AdrIndex,
  Finding,
  InventoryRow,
  LedgerRow,
  TestOutcome,
} from "./parity-check.ts";

const inventoryRow = (id: string, kind = "test"): InventoryRow => ({
  id,
  kind,
  source: id.split("::")[0]?.split(":").at(-1) ?? "",
  title: id.includes("::") ? id.slice(id.indexOf("::") + 2) : id,
});

const ledgerRow = (
  row: InventoryRow,
  overrides: Partial<LedgerRow> = {}
): LedgerRow => ({
  class: row.kind === "test" ? "A" : null,
  decision: null,
  disposition: "port",
  id: row.id,
  slice: "core",
  source: row.source,
  targets: [],
  ...overrides,
});

const noAdrs: AdrIndex = {
  accepted: new Map([
    ["0002", true],
    ["0003", false],
  ]),
};

const messages = (errors: readonly Finding[]) =>
  errors.map((error) => error.message);

describe("parseLedger", () => {
  it("accepts well-formed rows and rejects malformed ones", () => {
    const errors: Finding[] = [];
    const good = ledgerRow(inventoryRow("pe:test:a.ts::works"));
    const rows = parseLedger(
      "core.json",
      {
        lane: "evaluation",
        rows: [
          good,
          { ...good, id: "x", disposition: "maybe" },
          { ...good, id: "y", decision: "adr:12" },
          { ...good, id: "z", note: "prose" },
        ],
        slice: "core",
      },
      errors
    );

    assert.deepEqual(rows, [good]);
    assert.deepEqual(messages(errors), [
      "unknown disposition",
      "decision must be null, adr:NNNN or issue:N",
      "a row has exactly the keys class,decision,disposition,id,slice,source,targets",
    ]);
  });

  it("checks the file's own keys, slice and lane", () => {
    const errors: Finding[] = [];
    parseLedger("core.json", { lane: "x", rows: [], slice: "other" }, errors);

    assert.deepEqual(messages(errors), [
      'slice must be "core"',
      "lane must be evaluation, academy or platform",
    ]);
  });
});

describe("checkLedger", () => {
  const passing = inventoryRow("pe:test:a.ts::passes");
  const failing = inventoryRow("pe:test:a.ts::fails");
  const pending = inventoryRow("pe:test:b.ts::waits");
  const clause = inventoryRow("pe:rubric:scope:01", "doc-rule");
  const outcomes = new Map<string, TestOutcome>([
    ["packages/core/a.test.ts::passes", "passed"],
    ["packages/core/a.test.ts::fails", "failed"],
    ["packages/core/a.test.ts::skips", "skipped"],
  ]);

  it("derives verified, open, blocked and terminal statuses", () => {
    const result = checkLedger(
      [passing, failing, pending, clause],
      [
        ledgerRow(passing, { targets: ["packages/core/a.test.ts::passes"] }),
        ledgerRow(failing),
        ledgerRow(pending, {
          decision: "adr:0003",
          disposition: "pending-decision",
        }),
        ledgerRow(clause, { disposition: "informative" }),
      ],
      noAdrs,
      outcomes
    );

    assert.deepEqual(result.errors, []);
    assert.deepEqual(Object.fromEntries(result.statuses), {
      [passing.id]: "verified",
      [failing.id]: "open",
      [pending.id]: "blocked",
      [clause.id]: "terminal",
    });
  });

  it("rejects failing, skipped, missing and renamed targets", () => {
    const result = checkLedger(
      [passing, failing],
      [
        ledgerRow(passing, {
          targets: [
            "packages/core/a.test.ts::skips",
            "packages/core/a.test.ts::gone",
          ],
        }),
        ledgerRow(failing, { targets: ["packages/core/a.test.ts::fails"] }),
      ],
      noAdrs,
      outcomes
    );

    assert.deepEqual(messages(result.errors), [
      'target "packages/core/a.test.ts::skips" must keep the source title "passes"',
      'target "packages/core/a.test.ts::gone" must keep the source title "passes"',
      'target "packages/core/a.test.ts::skips" is skipped; only pending-decision rows may skip',
      'target "packages/core/a.test.ts::gone" is not in the reports',
      'target "packages/core/a.test.ts::fails" fails',
    ]);
    assert.equal(result.statuses.get(passing.id), "open");
  });

  it("requires an accepted ADR for port-changed, superseded and drop", () => {
    const rows = [passing, failing, pending].map((row, index) =>
      ledgerRow(row, {
        decision: index === 0 ? "adr:0002" : "adr:0003",
        disposition: index === 2 ? "drop" : "port-changed",
      })
    );
    const result = checkLedger(
      [passing, failing, pending],
      rows,
      noAdrs,
      undefined
    );

    assert.deepEqual(messages(result.errors), [
      "adr:0003 is not accepted",
      "adr:0003 is not accepted",
    ]);
  });

  it("finds rows missing from the ledger, duplicated or unknown", () => {
    const result = checkLedger(
      [passing, failing],
      [
        ledgerRow(passing),
        ledgerRow(passing),
        ledgerRow(inventoryRow("pe:test:z.ts::ghost")),
      ],
      noAdrs,
      undefined
    );

    assert.deepEqual(messages(result.errors), [
      "inventory row missing from the ledger",
      "ledger holds this row 2 times",
      "ledger row is not in the inventory",
    ]);
  });

  it("warns, without failing, when ADR references cannot be resolved", () => {
    const result = checkLedger(
      [pending],
      [
        ledgerRow(pending, {
          decision: "adr:0003",
          disposition: "pending-decision",
        }),
      ],
      { accepted: undefined },
      undefined
    );

    assert.deepEqual(result.errors, []);
    assert.equal(result.warnings.length, 1);
  });
});

describe("readTestOutcomes", () => {
  it("reads Vitest reports with absolute paths and Playwright reports", () => {
    const vitest = readTestOutcomes(
      {
        testResults: [
          {
            assertionResults: [
              { ancestorTitles: ["Outer"], status: "passed", title: "ok" },
              { ancestorTitles: [], status: "pending", title: "later" },
            ],
            name: "/repo/packages/core/src/a.test.ts",
          },
        ],
      },
      "/repo"
    );
    const playwright = readTestOutcomes(
      {
        config: { rootDir: "/repo/e2e" },
        suites: [
          {
            file: "journey.spec.ts",
            specs: [{ tests: [{ status: "unexpected" }], title: "breaks" }],
            suites: [],
          },
        ],
      },
      "/repo"
    );

    assert.deepEqual(Object.fromEntries(vitest), {
      "packages/core/src/a.test.ts::Outer > ok": "passed",
      "packages/core/src/a.test.ts::later": "skipped",
    });
    assert.deepEqual(Object.fromEntries(playwright), {
      "e2e/journey.spec.ts::breaks": "failed",
    });
  });
});
