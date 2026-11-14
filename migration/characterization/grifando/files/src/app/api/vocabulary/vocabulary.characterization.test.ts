// Characterization of the vocabulary routes at the Grifando baseline (src/app/api/vocabulary/**),
// neither of which has a test: saving an item and deleting it.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { createPrismaClient } from "@/server/db/client";
import { resetDatabase } from "@/server/db/test-utils";

const holder = vi.hoisted(() => ({
  prisma: undefined as unknown,
  userId: "visitor-1",
  provider: undefined as unknown,
}));

vi.mock("@/server/db/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/db/client")>();
  // Not via test-utils: it imports this (mocked) module, which would deadlock.
  holder.prisma = original.createPrismaClient(process.env.TEST_DATABASE_URL!);
  return { ...original, prisma: holder.prisma };
});
vi.mock("@/server/session/currentUser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/session/currentUser")>()),
  getCurrentUserId: vi.fn(async () => holder.userId),
}));
vi.mock("@/server/rateLimit", () => ({ rateLimitResponse: async () => null }));
vi.mock("@/server/ai/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/ai/client")>()),
  createAIProvider: vi.fn(() => ({ provider: holder.provider, modelId: "test-model" })),
}));

import { DELETE as deleteItem } from "@/app/api/vocabulary/[id]/route";
import { POST as postItem } from "@/app/api/vocabulary/route";

const prisma = holder.prisma as ReturnType<typeof createPrismaClient>;
const AI_HEADERS = { "x-ai-provider": "gemini", "x-ai-key": "test-key" };

function params<T extends Record<string, string>>(values: T) {
  return { params: Promise.resolve(values) } as never;
}

function json(method: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://test/api", {
    method,
    headers: { "content-type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function seedUser(userId: string) {
  await prisma.user.upsert({ where: { id: userId }, create: { id: userId }, update: {} });
}

function analysisResult() {
  return {
    correctedText: "I worked on a payments API.",
    naturalText: "I have been building a payments API.",
    overallFeedback: "Clear and professional.",
    scores: { grammar: 85, vocabulary: 80, clarity: 88, naturalness: 82, technicalCommunication: 90 },
    mistakes: [
      {
        originalSpan: "work in",
        correctedSpan: "worked on",
        category: "PREPOSITIONS",
        severity: "ERROR",
        explanation: "Use the past tense and \"on\" for projects.",
        example: "I worked on a payments API.",
        patternKey: "work-on-project",
      },
    ],
  };
}

function fakeProvider() {
  return {
    analyzeWriting: vi.fn(async () => analysisResult()),
    generateExercises: vi.fn(),
    continueInterview: vi.fn(async () => ({ question: "What did you work on recently?" })),
    explainAttempt: vi.fn(),
  };
}

const keys = (value: unknown) => Object.keys(value as object).toSorted().join(", ");

afterAll(async () => {
  vi.unstubAllEnvs();
  await prisma.$disconnect();
});

beforeEach(async () => {
  vi.stubEnv("AI_PROVIDER", "");
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  holder.userId = "visitor-1";
  holder.provider = fakeProvider();
  await resetDatabase(prisma);
});

const item = { term: "rely on", meaningPt: "depender de", exampleSentence: "I rely on the test suite." };

describe("vocabulary routes", () => {
  it("saves an item and answers 201 with it", async () => {
    const response = await postItem(json("POST", { ...item, term: "  rely on  " }));
    expect(response.status).toBe(201);
    const saved = (await response.json()) as Record<string, unknown>;
    expect(saved).toMatchObject({ ...item, userId: "visitor-1", sourceSessionId: null });
    expect(keys(saved)).toBe("createdAt, exampleSentence, id, meaningPt, sourceSessionId, term, userId");
  });

  it("answers 400 with the validation issues for a missing field", async () => {
    const response = await postItem(json("POST", { term: "rely on" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "Invalid request body", issues: [expect.any(Object), expect.any(Object)] });
  });

  it("deletes the visitor's item with 204, and 404s for an unknown or another user's item", async () => {
    const saved = (await (await postItem(json("POST", item))).json()) as { id: string };
    holder.userId = "other-user";
    const foreign = await deleteItem(json("DELETE", undefined), params({ id: saved.id }));
    holder.userId = "visitor-1";
    const deleted = await deleteItem(json("DELETE", undefined), params({ id: saved.id }));
    const again = await deleteItem(json("DELETE", undefined), params({ id: saved.id }));

    expect([foreign.status, deleted.status, again.status]).toEqual([404, 204, 404]);
    expect(await deleted.text()).toBe("");
    expect(await again.json()).toEqual({ error: "Not found" });
  });
});
