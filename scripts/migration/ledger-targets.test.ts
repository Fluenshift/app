import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { passedTests, withTargets } from "./ledger-targets.ts";

const rows = [
  {
    disposition: "port",
    id: "grifando:characterization:src/a.test.ts::/a > reads it",
    source: "src/a.test.ts",
    targets: [],
  },
  {
    disposition: "port-changed",
    id: "grifando:characterization:src/a.test.ts::/b > reads the query",
    source: "src/a.test.ts",
    targets: [],
  },
  {
    disposition: "port",
    id: "grifando:test:src/c.test.ts::c > works",
    source: "src/c.test.ts",
    targets: [],
  },
];

describe("withTargets", () => {
  it("gives every row of the source one target per test file, under its source title", () => {
    const passed = new Set([
      "server.test.ts::/a > reads it",
      "web.test.tsx::/a > reads it",
      "server.test.ts::/b > reads the query",
      "web.test.tsx::/b > reads the query",
    ]);

    const updated = withTargets(
      rows,
      {
        source: "src/a.test.ts",
        targets: ["server.test.ts", "web.test.tsx"],
        titles: [],
      },
      passed
    );

    assert.deepEqual(
      updated.map(({ targets }) => targets),
      [
        ["server.test.ts::/a > reads it", "web.test.tsx::/a > reads it"],
        [
          "server.test.ts::/b > reads the query",
          "web.test.tsx::/b > reads the query",
        ],
        [],
      ]
    );
    assert.equal(updated[0]?.id, rows[0]?.id);
  });

  it("renames the target of one port-changed row", () => {
    const updated = withTargets(
      rows,
      {
        as: "/b > reads the history state",
        source: "src/a.test.ts",
        targets: ["web.test.tsx"],
        titles: ["/b > reads the query"],
      },
      new Set(["web.test.tsx::/b > reads the history state"])
    );

    assert.deepEqual(updated[1]?.targets, [
      "web.test.tsx::/b > reads the history state",
    ]);
    assert.deepEqual(updated[0]?.targets, []);
  });

  it("refuses a rename for a port row", () => {
    assert.throws(
      () =>
        withTargets(
          rows,
          {
            as: "/a > renamed",
            source: "src/a.test.ts",
            targets: ["web.test.tsx"],
            titles: ["/a > reads it"],
          },
          new Set(["web.test.tsx::/a > renamed"])
        ),
      /one port-changed row/u
    );
  });

  it("refuses a target that did not pass, and a title that matches no row", () => {
    assert.throws(
      () =>
        withTargets(
          rows,
          { source: "src/c.test.ts", targets: ["c.test.ts"], titles: [] },
          new Set()
        ),
      /not passed in the reports/u
    );
    assert.throws(
      () =>
        withTargets(
          rows,
          {
            source: "src/a.test.ts",
            targets: ["web.test.tsx"],
            titles: ["/a > reads it", "/z > missing"],
          },
          new Set(["web.test.tsx::/a > reads it"])
        ),
      /1 rows match 2 titles/u
    );
  });
});

describe("passedTests", () => {
  it("keeps only the passed tests of Vitest reports, by repo-relative file", () => {
    const passed = passedTests(
      [
        {
          testResults: [
            {
              assertionResults: [
                { ancestorTitles: ["/a"], status: "passed", title: "reads it" },
                { ancestorTitles: ["/a"], status: "failed", title: "breaks" },
              ],
              name: "/repo/apps/web/src/a.test.tsx",
            },
          ],
        },
      ],
      "/repo"
    );

    assert.deepEqual([...passed], ["apps/web/src/a.test.tsx::/a > reads it"]);
  });
});
