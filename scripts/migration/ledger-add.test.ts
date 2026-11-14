import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { missingRows } from "./ledger-add.ts";

const inventory = [
  { id: "pe:characterization:a::one", kind: "characterization", source: "a" },
  { id: "pe:characterization:a::two", kind: "characterization", source: "a" },
  { id: "pe:test:b::three", kind: "test", source: "b" },
  { id: "pe:rubric:scope:01", kind: "doc-rule", source: "RUBRIC.md" },
];

describe("missingRows", () => {
  it("adds only matching rows that the ledger lacks, as port rows", () => {
    const rows = missingRows(
      inventory,
      new Set(["pe:characterization:a::one"]),
      ["pe:characterization:"],
      "evaluation-core",
      "A"
    );

    assert.deepEqual(rows, [
      {
        class: "A",
        decision: null,
        disposition: "port",
        id: "pe:characterization:a::two",
        slice: "evaluation-core",
        source: "a",
        targets: [],
      },
    ]);
  });

  it("requires a class for test rows and none for other rows", () => {
    assert.throws(
      () => missingRows(inventory, new Set(), ["pe:test:"], "s", null),
      /need --class/
    );
    assert.throws(
      () => missingRows(inventory, new Set(), ["pe:rubric:"], "s", "A"),
      /need --class/
    );
  });
});
