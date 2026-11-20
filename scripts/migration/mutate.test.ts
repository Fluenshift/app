import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyOnce, failedTests } from "./mutate.ts";

describe("applyOnce", () => {
  it("replaces the one occurrence, taking the replacement literally", () => {
    assert.equal(applyOnce("a < b", "<", "$&<="), "a $&<= b");
  });

  it("refuses text that occurs twice or not at all", () => {
    assert.throws(() => applyOnce("a < b < c", "<", "<="), /found 2/u);
    assert.throws(() => applyOnce("a < b", ">", "<="), /found 0/u);
  });
});

describe("failedTests", () => {
  it("lists failed tests and files that failed to load, never skipped ones", () => {
    assert.deepEqual(
      failedTests({
        testResults: [
          {
            assertionResults: [
              { fullName: "a > passes", status: "passed" },
              { fullName: "a > fails", status: "failed" },
              { fullName: "a > waits", status: "skipped" },
            ],
            name: "a.test.ts",
            status: "failed",
          },
          {
            assertionResults: [],
            message: "Cannot find module './gone'",
            name: "b.test.ts",
            status: "failed",
          },
        ],
      }),
      ["a > fails", "file b.test.ts: Cannot find module './gone'"]
    );
  });
});
