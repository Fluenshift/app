import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { collectPages, evaluate, parseVerdict } from "./verdict-check.ts";
import type { Comment } from "./verdict-check.ts";

const HEAD = "a".repeat(40);
const OLD = "b".repeat(40);
const pr = { headSha: HEAD, labels: ["implementer:claude", "lane:core"] };

let nextId = 1;
const comment = (body: string, overrides: Partial<Comment> = {}): Comment => {
  nextId += 1;
  return {
    association: "OWNER",
    author: "owner",
    body,
    createdAt: `2026-11-13T12:00:${String(nextId).padStart(2, "0")}Z`,
    id: nextId,
    ...overrides,
  };
};
const verdict = (outcome: string, verifier: string, head: string) =>
  `G12 ${outcome}\nVerifier: ${verifier}\nHead: ${head}\n\nReasons follow.`;

describe("parseVerdict", () => {
  it("reads the three header lines and nothing else", () => {
    assert.deepEqual(parseVerdict(verdict("PASS", "codex", HEAD)), {
      head: HEAD,
      pass: true,
      verifier: "codex",
    });
    assert.deepEqual(
      parseVerdict(`G12 BLOCK\r\nVerifier: claude\r\nHead: ${HEAD}`),
      {
        head: HEAD,
        pass: false,
        verifier: "claude",
      }
    );
    assert.equal(
      parseVerdict(`Looks good.\n${verdict("PASS", "codex", HEAD)}`),
      undefined
    );
    assert.equal(
      parseVerdict(`G12 PASS\nVerifier: codex\nHead: ${HEAD.slice(0, 7)}`),
      undefined
    );
  });
});

describe("evaluate", () => {
  it("passes on a PASS from the other vendor for the current head", () => {
    assert.equal(
      evaluate(pr, [comment(verdict("PASS", "codex", HEAD))]).pass,
      true
    );
  });

  it("uses the newest verdict for the current head", () => {
    const comments = [
      comment(verdict("PASS", "codex", HEAD)),
      comment(verdict("BLOCK", "codex", HEAD)),
    ];

    assert.equal(evaluate(pr, comments).pass, false);
    assert.equal(evaluate(pr, comments.toReversed()).pass, false);
  });

  it("ignores verdicts for older heads and from non-members", () => {
    const result = evaluate(pr, [
      comment(verdict("PASS", "codex", OLD)),
      comment(verdict("PASS", "codex", HEAD), { association: "NONE" }),
    ]);

    assert.deepEqual(result, {
      description: "no verdict from an organization member for aaaaaaa",
      pass: false,
    });
  });

  it("refuses a verdict from the implementing vendor or an unknown one", () => {
    assert.match(
      evaluate(pr, [comment(verdict("PASS", "claude", HEAD))]).description,
      /implementing vendor/
    );
    assert.match(
      evaluate(pr, [comment(verdict("PASS", "gemini", HEAD))]).description,
      /unknown verifier/
    );
  });

  it("requires exactly one implementer label", () => {
    const passing = [comment(verdict("PASS", "codex", HEAD))];

    assert.equal(evaluate({ ...pr, labels: [] }, passing).pass, false);
    assert.equal(
      evaluate(
        { ...pr, labels: ["implementer:claude", "implementer:codex"] },
        passing
      ).pass,
      false
    );
  });
});

describe("collectPages", () => {
  it("reads pages until one comes back short", () => {
    const pages = [[1, 2], [3, 4], [5]];
    const requested: number[] = [];

    const items = collectPages((page) => {
      requested.push(page);
      return pages[page - 1];
    }, 2);

    assert.deepEqual(items, [1, 2, 3, 4, 5]);
    assert.deepEqual(requested, [1, 2, 3]);
  });

  it("reads one more page after a full last page", () => {
    const pages = [[1, 2], []];

    assert.deepEqual(
      collectPages((page) => pages[page - 1], 2),
      [1, 2]
    );
  });

  it("rejects a page that is not an array", () => {
    assert.throws(
      () => collectPages(() => ({ message: "Not Found" })),
      /page 1: expected a JSON array/
    );
  });
});
