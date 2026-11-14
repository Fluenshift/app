import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("keeps the last of two conflicting Tailwind utilities", () => {
    expect(cn("p-2", false, "p-4")).toBe("p-4");
  });
});
