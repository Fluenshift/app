import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parsePins, remoteUrl } from "./baselines.ts";

const pin = {
  commit: "0123456789abcdef0123456789abcdef01234567",
  repository: "Owner/repo",
  tag: "parity-baseline",
};

describe("parsePins", () => {
  it("reads valid pins, including bumped tags", () => {
    const pins = parsePins(
      JSON.stringify({ a: pin, b: { ...pin, tag: "parity-baseline-2" } })
    );

    assert.deepEqual(pins.get("a"), pin);
    assert.equal(pins.get("b")?.tag, "parity-baseline-2");
    assert.equal(remoteUrl(pin), "https://github.com/Owner/repo.git");
  });

  it("rejects extra keys, bad tags, short commits and empty files", () => {
    const invalid = [
      { a: { ...pin, note: "prose" } },
      { a: { ...pin, tag: "v1" } },
      { a: { ...pin, tag: "parity-baseline-1" } },
      { a: { ...pin, commit: "abc" } },
      { a: { ...pin, repository: "not a repo" } },
      { "Bad Name": pin },
      {},
    ];

    for (const data of invalid)
      assert.throws(() => parsePins(JSON.stringify(data)), /baselines\.json/);
  });
});
