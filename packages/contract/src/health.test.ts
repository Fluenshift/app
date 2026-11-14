import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { HealthResponse } from "./health";

describe("HealthResponse", () => {
  it("accepts the health payload", () => {
    expect(Schema.decodeSync(HealthResponse)({ status: "ok" })).toStrictEqual({
      status: "ok",
    });
  });

  it("rejects any other status", () => {
    expect(() =>
      Schema.decodeUnknownSync(HealthResponse)({ status: "down" })
    ).toThrow('Expected "ok"');
  });
});
