import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { unionLedgers } from "./ledger-union.ts";

const row = (id: string, targets: string[], disposition = "port") => ({
  class: "C",
  decision: disposition === "port" ? null : "adr:0004",
  disposition,
  id,
  slice: "academy-http",
  source: "s",
  targets,
});

const ledger = (rows: ReturnType<typeof row>[]) => ({
  lane: "academy",
  rows,
  slice: "academy-http",
});

describe("unionLedgers", () => {
  it("keeps both sides' rows in inventory order and the union of their targets", () => {
    const merged = unionLedgers(
      ledger([row("g:t:s::b 10", ["x::b 10"]), row("g:t:s::b 2", [])]),
      ledger([row("g:t:s::b 2", ["y::b 2"]), row("g:t:s::b 10", ["z::b 10"])])
    );

    assert.deepEqual(
      merged.rows.map(({ id, targets }) => [id, targets]),
      [
        ["g:t:s::b 2", ["y::b 2"]],
        ["g:t:s::b 10", ["x::b 10", "z::b 10"]],
      ]
    );
  });

  it("adds a row only one side has", () => {
    const merged = unionLedgers(
      ledger([row("g:t:s::a", [])]),
      ledger([row("g:t:s::a", []), row("g:t:s::c", ["t::c"])])
    );

    assert.deepEqual(
      merged.rows.map(({ id }) => id),
      ["g:t:s::a", "g:t:s::c"]
    );
  });

  it("refuses a row whose disposition differs between the sides", () => {
    assert.throws(
      () =>
        unionLedgers(
          ledger([row("g:t:s::a", [])]),
          ledger([row("g:t:s::a", [], "port-changed")])
        ),
      /differs in disposition or decision/u
    );
  });
});
