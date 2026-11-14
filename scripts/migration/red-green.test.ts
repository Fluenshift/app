import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  failureKind,
  judgeGreen,
  judgeRed,
  newTargets,
  readVitestResults,
  splitTarget,
} from "./red-green.ts";
import type { TestResult } from "./red-green.ts";

const ledger = (...targets: string[][]) => ({
  slice: "academy-core",
  lane: "academy",
  rows: targets.map((rowTargets, index) => ({
    id: `row-${index}`,
    targets: rowTargets,
  })),
});

const A = "packages/core/src/a.test.ts::a > adds";
const B = "packages/core/src/a.test.ts::a > subtracts";
const C = "packages/core/src/b.test.ts::b > divides";

describe("newTargets", () => {
  it("lists the targets the head adds over the base", () => {
    const base = new Map([["academy-core.json", ledger([A], [])]]);
    const head = new Map([
      ["academy-core.json", ledger([A], [C, B])],
      ["academy-trainer.json", ledger([])],
    ]);

    assert.deepEqual(newTargets(base, head), [B, C]);
    assert.deepEqual(newTargets(head, head), []);
  });

  it("splits a target into its file and full title", () => {
    assert.deepEqual(splitTarget(A), {
      file: "packages/core/src/a.test.ts",
      title: "a > adds",
    });
  });
});

describe("readVitestResults", () => {
  it("keys each test by its repo-relative file and full title", () => {
    const report = {
      testResults: [
        {
          name: "/repo/packages/core/src/a.test.ts",
          assertionResults: [
            {
              ancestorTitles: ["a"],
              title: "adds",
              status: "passed",
              failureMessages: [],
            },
            {
              ancestorTitles: ["a"],
              title: "subtracts",
              status: "failed",
              failureMessages: ["AssertionError: expected 1 to be 2"],
            },
            {
              ancestorTitles: ["a"],
              title: "later",
              status: "todo",
              failureMessages: [],
            },
          ],
        },
      ],
    };

    assert.deepEqual(
      [...readVitestResults(report, "/repo")],
      [
        [A, { status: "passed", message: "" }],
        [
          B,
          { status: "failed", message: "AssertionError: expected 1 to be 2" },
        ],
        [
          "packages/core/src/a.test.ts::a > later",
          { status: "skipped", message: "" },
        ],
      ]
    );
  });
});

describe("failureKind", () => {
  it("tells assertions from missing code", () => {
    assert.equal(
      failureKind("AssertionError: expected NaN to be 1 // Object.is equality"),
      "assertion"
    );
    assert.equal(
      failureKind("TypeError: add is not a function\n    at a.test.ts:3"),
      "missing-binding"
    );
    assert.equal(
      failureKind("ReferenceError: add is not defined"),
      "missing-binding"
    );
    assert.equal(
      failureKind(
        "SyntaxError: The requested module './a' does not provide an export named 'add'"
      ),
      "missing-binding"
    );
    assert.equal(failureKind(""), "other");
    assert.equal(
      failureKind(
        "TypeError: Cannot read properties of undefined (reading 'map')"
      ),
      "other"
    );
  });
});

const workspaceOf = () => "packages/core";
const failed = (message: string): TestResult => ({
  status: "failed",
  message,
});

describe("judgeRed", () => {
  it("accepts targets that fail on their checks", () => {
    const results = new Map([
      [A, failed("AssertionError: expected NaN to be 1")],
      [B, failed("")],
    ]);

    assert.deepEqual(
      judgeRed("abc1234", [A, B], results, new Map(), workspaceOf),
      {
        red: [A, B],
        problems: [],
        nonAssertion: [B],
      }
    );
  });

  it("rejects a target that passes, is skipped, is missing code or does not load", () => {
    const results = new Map<string, TestResult>([
      [A, { status: "passed", message: "" }],
      [B, failed("TypeError: subtract is not a function")],
      [C, { status: "skipped", message: "" }],
    ]);
    const unloaded = "packages/core/src/c.test.ts::c > loads";

    assert.deepEqual(
      judgeRed("abc1234", [A, B, C, unloaded], results, new Map(), workspaceOf)
        .problems,
      [
        `${A}: passes at abc1234, before its code`,
        `${B}: fails at abc1234 on a missing binding: TypeError: subtract is not a function`,
        `${C}: is skipped at abc1234`,
        `${unloaded}: is not collected at abc1234; does its file load?`,
      ]
    );
  });

  it("rejects a target whose workspace does not typecheck", () => {
    const results = new Map([
      [A, failed("AssertionError: expected NaN to be 1")],
    ]);
    const typecheck = new Map([
      ["packages/core", "src/a.ts(1,1): error TS2305"],
    ]);

    assert.deepEqual(
      judgeRed("abc1234", [A], results, typecheck, workspaceOf).problems,
      [`${A}: does not typecheck at abc1234: src/a.ts(1,1): error TS2305`]
    );
  });
});

describe("judgeGreen", () => {
  it("requires every target to pass", () => {
    const results = new Map<string, TestResult>([
      [A, { status: "passed", message: "" }],
      [B, { status: "failed", message: "AssertionError" }],
    ]);

    assert.deepEqual(judgeGreen([A, B, C], results), [
      `${B}: failed in the checked-out tree`,
      `${C}: does not run in the checked-out tree`,
    ]);
  });
});
