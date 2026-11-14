import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bunJunitTests,
  markdownBlocks,
  markdownSections,
  naturalCompare,
  peDockerSmokeChecks,
  playwrightTests,
  vitestTests,
} from "./inventory.ts";

const suite = (cwd: string, runner: string) => ({
  cwd,
  id: "suite",
  report: "report",
  runner,
});

const vitestReport = (name: string, status: string) => ({
  testResults: [
    {
      assertionResults: [
        { ancestorTitles: ["Outer", "Inner"], status, title: "case" },
      ],
      name,
    },
  ],
});

describe("naturalCompare", () => {
  it("orders digit runs as numbers and the rest by code unit", () => {
    const ids = ["x:issue:22", "x:issue:4", "x:issue:10", "x:Issue:1", "x:a"];

    assert.deepEqual(ids.toSorted(naturalCompare), [
      "x:Issue:1",
      "x:a",
      "x:issue:4",
      "x:issue:10",
      "x:issue:22",
    ]);
  });

  it("orders a prefix before its extensions and equal numbers by spelling", () => {
    assert.ok(naturalCompare("a:1", "a:1:b") < 0);
    assert.ok(naturalCompare("a:01", "a:1") < 0);
    assert.equal(naturalCompare("same", "same"), 0);
  });
});

describe("bunJunitTests", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="bun test" tests="5">
  <testsuite name="src/a.test.ts" file="src/a.test.ts" tests="4">
    <testcase name="top level" classname="" file="src/a.test.ts" line="1" />
    <testsuite name="Outer" file="src/a.test.ts" line="2">
      <testcase name="passes &amp; escapes &quot;quotes&quot;" classname="Outer" file="src/a.test.ts" line="3" />
      <testsuite name="Inner" file="src/a.test.ts" line="4">
        <testcase name="fails" classname="Inner" file="src/a.test.ts" line="5">
          <failure type="AssertionError" />
        </testcase>
        <testcase name="is skipped" classname="Inner" file="src/a.test.ts" line="6">
          <skipped />
        </testcase>
      </testsuite>
    </testsuite>
  </testsuite>
  <testsuite name="src/b.test.ts" file="src/b.test.ts" tests="1">
    <testcase name="other file" classname="" file="src/b.test.ts" line="1" />
  </testsuite>
</testsuites>`;

  it("joins describe titles, resolves paths from the suite directory and reads outcomes", () => {
    const rows = bunJunitTests(xml, "pe", suite("apps/server", "bun-junit"));

    assert.deepEqual(
      rows.map((row) => [row.source, row.title, row.baseline]),
      [
        ["apps/server/src/a.test.ts", "top level", "green"],
        [
          "apps/server/src/a.test.ts",
          'Outer > passes & escapes "quotes"',
          "green",
        ],
        ["apps/server/src/a.test.ts", "Outer > Inner > fails", "baseline-red"],
        ["apps/server/src/a.test.ts", "Outer > Inner > is skipped", "skipped"],
        ["apps/server/src/b.test.ts", "other file", "green"],
      ]
    );
    assert.equal(rows[0]?.id, "pe:test:apps/server/src/a.test.ts::top level");
  });

  it("rejects unbalanced reports", () => {
    assert.throws(
      () =>
        bunJunitTests(
          '<testsuite name="f" file="f"><testcase name="t" file="f">',
          "pe",
          suite(".", "bun-junit")
        ),
      /unbalanced junit/
    );
  });
});

describe("vitestTests", () => {
  it("maps statuses and joins ancestor titles", () => {
    const statuses = ["passed", "failed", "skipped", "pending", "todo"];
    const baselines = statuses.map(
      (status) =>
        vitestTests(
          vitestReport("src/a.test.ts", status),
          "grifando",
          suite(".", "vitest-json")
        )[0]?.baseline
    );

    assert.deepEqual(baselines, [
      "green",
      "baseline-red",
      "skipped",
      "skipped",
      "todo",
    ]);
    assert.equal(
      vitestTests(
        vitestReport("src/a.test.ts", "passed"),
        "grifando",
        suite(".", "vitest-json")
      )[0]?.id,
      "grifando:test:src/a.test.ts::Outer > Inner > case"
    );
  });

  it("refuses absolute paths and unknown statuses", () => {
    assert.throws(
      () =>
        vitestTests(
          vitestReport("/abs/a.test.ts", "passed"),
          "pe",
          suite(".", "vitest-json")
        ),
      /not normalized/
    );
    assert.throws(
      () =>
        vitestTests(
          vitestReport("a.test.ts", "flaky"),
          "pe",
          suite(".", "vitest-json")
        ),
      /unknown status/
    );
  });
});

describe("playwrightTests", () => {
  it("drops the file suite from the title and keeps nested describes", () => {
    const report = {
      config: { rootDir: "e2e" },
      suites: [
        {
          file: "mvp.spec.ts",
          specs: [{ tests: [{ status: "expected" }], title: "top level" }],
          suites: [
            {
              specs: [
                { tests: [{ status: "unexpected" }], title: "fails" },
                { tests: [{ status: "skipped" }], title: "is skipped" },
              ],
              title: "Journey",
            },
          ],
          title: "mvp.spec.ts",
        },
      ],
    };

    assert.deepEqual(
      playwrightTests(report, "pe", suite(".", "playwright-json")).map(
        (row) => [row.source, row.title, row.baseline]
      ),
      [
        ["e2e/mvp.spec.ts", "Journey > fails", "baseline-red"],
        ["e2e/mvp.spec.ts", "Journey > is skipped", "skipped"],
        ["e2e/mvp.spec.ts", "top level", "green"],
      ]
    );
  });
});

describe("markdown clauses", () => {
  const markdown = [
    "# Title",
    "",
    "Intro wraps",
    "over two lines.",
    "",
    "## Rules",
    "",
    "- first item",
    "  continues here",
    "- second item",
    "1. numbered item",
    "",
    "| Head | Other |",
    "| --- | ---: |",
    "| a | b |",
    "| c | d |",
    "",
    "```",
    "# not a heading",
    "code line",
    "```",
    "",
    "> quoted",
    "> text",
  ].join("\n");

  it("splits sections by heading and ignores headings inside code fences", () => {
    assert.deepEqual(
      markdownSections(markdown).map((section) => section.headings),
      [["Title"], ["Title", "Rules"]]
    );
  });

  it("yields paragraphs, top-level items, table data rows and code blocks", () => {
    const [intro, rules] = markdownSections(markdown);

    assert.ok(intro !== undefined && rules !== undefined);
    assert.deepEqual(markdownBlocks(intro), [
      { kind: "paragraph", line: 3, text: "Intro wraps over two lines." },
    ]);
    assert.deepEqual(
      markdownBlocks(rules).map((block) => [
        block.kind,
        block.line,
        block.text,
      ]),
      [
        ["item", 8, "first item continues here"],
        ["item", 10, "second item"],
        ["item", 11, "numbered item"],
        ["row", 15, "a | b"],
        ["row", 16, "c | d"],
        ["code", 18, "# not a heading\ncode line"],
        ["paragraph", 23, "quoted text"],
      ]
    );
  });
});

describe("peDockerSmokeChecks", () => {
  it("lists assertions and in-container shell checks of main under their phase", () => {
    const source = [
      "const helper = () => {",
      "  assert.ok(true);",
      "};",
      "const main = async () => {",
      '  assert.ok(early, "before any phase");',
      '  report("Docker smoke: first phase");',
      '  await compose(["up"]);',
      "  assert.equal(",
      "    value,",
      "    joined(a, b)",
      "  );",
      '  await compose(["exec", "app", "sh", "-c", "test ! -e /x"]);',
      '  await assertNoSentinels("logs", text);',
      "};",
    ].join("\n");

    assert.deepEqual(
      peDockerSmokeChecks(source).map((row) => [row.id, row.title, row.text]),
      [
        ["pe:docker-smoke:L5", "main", 'assert.ok(early, "before any phase")'],
        [
          "pe:docker-smoke:L8",
          "Docker smoke: first phase",
          "assert.equal(value, joined(a, b))",
        ],
        [
          "pe:docker-smoke:L12",
          "Docker smoke: first phase",
          'compose(["exec", "app", "sh", "-c", "test ! -e /x"])',
        ],
        [
          "pe:docker-smoke:L13",
          "Docker smoke: first phase",
          'assertNoSentinels("logs", text)',
        ],
      ]
    );
  });
});
