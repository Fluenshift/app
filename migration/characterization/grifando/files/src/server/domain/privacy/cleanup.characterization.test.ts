// Characterization of cleanupIdleData in src/server/domain/privacy/cleanup.ts at the Grifando
// baseline: cleanup.test.ts deletes users idle 91 days and keeps 89-day ones, and deletes a window
// 3 days old and keeps one 1 day old, so it pins neither bound: a user idle exactly 90 days and a
// window exactly 2 days old both stay.
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestPrismaClient, resetDatabase } from "@/server/db/test-utils";
import { cleanupIdleData } from "./cleanup";

const prisma = createTestPrismaClient();
const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-07T12:00:00Z");

beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

describe("cleanupIdleData bounds", () => {
  it("keeps a user idle exactly 90 days and a rate-limit window exactly 2 days old", async () => {
    await prisma.user.create({ data: { id: "edge", lastActiveAt: new Date(now.getTime() - 90 * DAY) } });
    await prisma.rateLimitWindow.create({
      data: { key: "edge", windowStart: new Date(now.getTime() - 2 * DAY), count: 1 },
    });
    expect(await cleanupIdleData(prisma, now)).toEqual({ users: 0, windows: 0 });
  });
});
