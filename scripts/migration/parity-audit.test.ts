import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  auditRows,
  closingBracket,
  compareMetrics,
  literalValue,
  metrics,
  testBodies,
} from "./parity-audit.ts";
import type { AuditRow } from "./parity-audit.ts";

const source = `import { expect, test } from "bun:test";

describe("Rubric", () => {
  test("scores a sample", () => {
    // A ")" in a comment and in a string must not end the body.
    expect(score(9, [])).toBe(100);
    expect(score(9, ["Minor"])).toBe(85);
    expect(words("it's")).toEqual(['it\\'s']);
    expect(isValid("x")).toBeTrue();
    expect(() => parse(")")).toThrow("bad input");
  });

  test("bands a score", () => {
    expect(band(85)).not.toBe("Needs work");
  });
});
`;

// Spelled apart, so no plain string here looks like a template substitution.
const SUBSTITUTION = ["$", "{"].join("");

describe("reading test source", () => {
  it("finds the closing bracket past strings, templates and comments", () => {
    const text = `f(a, ")", \`${SUBSTITUTION}g(")")}\`, /* ) */ b) + 1`;

    assert.equal(closingBracket(text, 1), text.indexOf(" + 1") - 1);
  });

  it("reads string literals by value", () => {
    assert.equal(literalValue('"a \\"b\\""'), 'a "b"');
    assert.equal(literalValue("'it\\'s'"), "it's");
    assert.equal(literalValue("`plain`"), "plain");
    assert.equal(literalValue(`\`with ${SUBSTITUTION}x}\``), undefined);
  });

  it("locates a test body by its title", () => {
    const [body] = testBodies(source, "scores a sample");

    assert.ok(body?.includes("toThrow"));
    assert.ok(!body?.includes("Needs work"));
    assert.deepEqual(testBodies(source, "is not there"), []);
    assert.equal(
      testBodies(`${source}\ntest("bands a score", () => {});`, "bands a score")
        .length,
      2
    );
  });

  it("counts assertions, matchers and expected literals", () => {
    const [body = ""] = testBodies(source, "scores a sample");

    assert.deepEqual(metrics(body), {
      assertions: 5,
      matchers: ["toBe", "toBe", "toBe", "toEqual", "toThrow"],
      literals: ['"bad input"', '"it\'s"', "100", "85", "true"],
    });
    assert.deepEqual(
      metrics('expect(x).not.toBe(1_000); expect(p).resolves.toEqual("a");'),
      {
        assertions: 2,
        matchers: ["not.toBe", "resolves.toEqual"],
        literals: ['"a"', "1000"],
      }
    );
  });
});

describe("compareMetrics", () => {
  const ported = metrics(
    `expect(score(9, [])).toBe(100);
     expect(score(9, ["Minor"])).toBe(85);
     expect(words("it's")).toStrictEqual(["it's"]);
     expect(isValid("x")).toBe(true);
     expect(() => parse(")")).toThrow("bad input");`
  );
  const [body = ""] = testBodies(source, "scores a sample");

  it("passes a port that keeps or tightens every check", () => {
    assert.deepEqual(compareMetrics(metrics(body), ported), []);
  });

  it("fails fewer assertions, a weaker matcher and a missing literal", () => {
    const weaker = metrics(
      `expect(score(9, [])).toBe(100);
       expect(words("it's")).toMatchObject(["it's"]);
       expect(isValid("x")).toBe(true);
       expect(() => parse(")")).toThrow();`
    );

    assert.deepEqual(compareMetrics(metrics(body), weaker), [
      "4 assertions where the source has 5",
      "matcher toBe has no equally strict target",
      "matcher toEqual has no equally strict target",
      'expected literal "bad input" is missing from the targets',
      "expected literal 85 is missing from the targets",
    ]);
  });

  it("keeps a negated matcher negated", () => {
    assert.deepEqual(
      compareMetrics(
        metrics('expect(x).not.toBe("a");'),
        metrics('expect(x).toBe("a");')
      ),
      ["matcher not.toBe has no equally strict target"]
    );
  });
});

const row = (rowClass: string, id: string): AuditRow => ({
  id: `pe:test:a.test.ts::Rubric > ${id}`,
  source: "a.test.ts",
  class: rowClass,
  disposition: "port",
  targets: [`packages/core/src/a.test.ts::Rubric > ${id}`],
});
const target =
  'it("scores a sample", () => { expect(score(9, [])).toBe(100); });';

describe("auditRows", () => {
  it("fails class A and B rows and only reports class C rows", () => {
    const result = auditRows(
      [
        row("A", "scores a sample"),
        row("C", "bands a score"),
        row("B", "is gone"),
      ],
      () => source,
      () => `${target}\nit("bands a score", () => {});`
    );

    assert.equal(result.audited, 3);
    assert.deepEqual(result.reports, [
      "pe:test:a.test.ts::Rubric > bands a score: 0 assertions where the source has 1",
      "pe:test:a.test.ts::Rubric > bands a score: matcher not.toBe has no equally strict target",
      'pe:test:a.test.ts::Rubric > bands a score: expected literal "Needs work" is missing from the targets',
    ]);
    assert.equal(
      result.failures[0],
      "pe:test:a.test.ts::Rubric > scores a sample: 1 assertions where the source has 5"
    );
    assert.deepEqual(result.failures.slice(-2), [
      'pe:test:a.test.ts::Rubric > is gone: "is gone" is not found in a.test.ts',
      'pe:test:a.test.ts::Rubric > is gone: "is gone" is not found in packages/core/src/a.test.ts',
    ]);
  });

  it("skips rows that are not ported tests with targets", () => {
    const skipped: AuditRow[] = [
      { ...row("A", "scores a sample"), disposition: "pending-decision" },
      { ...row("A", "scores a sample"), targets: [] },
      { ...row("A", "scores a sample"), class: null },
    ];

    assert.deepEqual(
      auditRows(
        skipped,
        () => source,
        () => target
      ),
      {
        failures: [],
        reports: [],
        audited: 0,
      }
    );
  });
});
