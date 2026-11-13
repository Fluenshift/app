import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeReport } from "./baseline-run.ts";

describe("normalizeReport", () => {
  it("makes worktree paths relative and replaces every home directory", () => {
    const text =
      '{"name":"/work/tree/src/a.test.ts","root":"/work/tree","tool":"/home/me/bin/node","cache":"/tmp/run/home/.cache"}';

    assert.equal(
      normalizeReport(
        text,
        "/work/tree",
        ["/tmp/run/home", "/home/me"],
        "vitest-json"
      ),
      '{"name":"src/a.test.ts","root":".","tool":"~/bin/node","cache":"~/.cache"}\n'
    );
  });

  it("drops the hostname only from bun junit reports", () => {
    const xml = '<testsuite name="a" hostname="machine">\n';

    assert.equal(
      normalizeReport(xml, "/w", [], "bun-junit"),
      '<testsuite name="a">\n'
    );
    assert.equal(normalizeReport(xml, "/w", [], "vitest-json"), xml);
  });
});
