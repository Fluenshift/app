// Characterization of src/server/rateLimit.ts at the Grifando baseline: rateLimit.test.ts exhausts
// the generation bucket only and compares the 429's body with the exported message, so no test pins
// the other limits, the message's text, or that every call also counts against the client IP's
// daily ceiling.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { hashedClientIp } from "@/server/clientIp";
import { createTestPrismaClient, resetDatabase } from "@/server/db/test-utils";
import { RATE_LIMIT_MESSAGE, RATE_LIMITS, rateLimitResponse } from "@/server/rateLimit";

const prisma = createTestPrismaClient();

beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

describe("rate limits", () => {
  it("limits each bucket per minute, hour or day, and tells the visitor to slow down", () => {
    expect(RATE_LIMITS).toEqual({
      analysis: [
        { name: "analysis-min", max: 10, windowSeconds: 60 },
        { name: "analysis-day", max: 100, windowSeconds: 86_400 },
      ],
      generation: [
        { name: "generation-min", max: 5, windowSeconds: 60 },
        { name: "generation-day", max: 50, windowSeconds: 86_400 },
      ],
      write: [{ name: "write-min", max: 60, windowSeconds: 60 }],
      keyTest: [{ name: "keytest-hour", max: 5, windowSeconds: 3_600 }],
      ip: [{ name: "ip-day", max: 300, windowSeconds: 86_400 }],
    });
    expect(RATE_LIMIT_MESSAGE).toBe("You're going a bit fast. Wait a moment and try again.");
  });

  it("counts every call against the bucket's rules for the user and the client IP's daily ceiling", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T12:00:10Z"));
    try {
      const request = new Request("http://test", { headers: { "x-forwarded-for": "203.0.113.9" } });
      await rateLimitResponse(prisma, request, "u", "analysis");
      const rows = await prisma.rateLimitWindow.findMany({ orderBy: { key: "asc" } });
      expect(rows.map((row) => [row.key, row.windowStart.toISOString(), row.count])).toEqual([
        ["analysis-day:u", "2026-01-01T00:00:00.000Z", 1],
        ["analysis-min:u", "2026-01-01T12:00:00.000Z", 1],
        [`ip-day:${hashedClientIp(request.headers)}`, "2026-01-01T00:00:00.000Z", 1],
      ]);
    } finally {
      vi.useRealTimers();
    }
  });
});
