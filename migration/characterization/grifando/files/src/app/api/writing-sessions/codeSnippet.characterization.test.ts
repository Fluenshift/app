// Characterization of the code snippet of POST /api/writing-sessions at the Grifando baseline,
// which route.test.ts never sends: the route trims it, takes up to 2000 characters of it and
// hands it to the analysis, and refuses a blank or longer one with the validation issues before
// any analysis.
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

import { POST as postSession } from "@/app/api/writing-sessions/route";

const prisma = holder.prisma as ReturnType<typeof createPrismaClient>;
const AI_HEADERS = { "x-ai-provider": "gemini", "x-ai-key": "test-key" };

function json(method: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://test/api", {
    method,
    headers: { "content-type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
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

const explanation = {
  promptType: "EXPLAIN_CODE",
  promptText: "Explain what this code does.",
  originalText: "This function checks whether the user already exists.",
};

function analyzeWriting() {
  return (holder.provider as ReturnType<typeof fakeProvider>).analyzeWriting;
}

describe("writing session code snippet", () => {
  it("trims a code snippet and hands up to 2000 characters of it to the analysis", async () => {
    const snippet = "x".repeat(2000);
    const response = await postSession(json("POST", { ...explanation, codeSnippet: `  ${snippet}\n` }, AI_HEADERS));

    expect(response.status).toBe(201);
    expect(analyzeWriting()).toHaveBeenCalledWith(expect.objectContaining({ codeSnippet: snippet }));
  });

  it("answers 400 with the validation issues for a blank code snippet or one over 2000 characters, before any analysis", async () => {
    const blank = await postSession(json("POST", { ...explanation, codeSnippet: "   " }, AI_HEADERS));
    const tooLong = await postSession(json("POST", { ...explanation, codeSnippet: "x".repeat(2001) }, AI_HEADERS));

    expect(blank.status).toBe(400);
    expect(await blank.json()).toMatchObject({ error: "Invalid request body", issues: [expect.objectContaining({ path: ["codeSnippet"] })] });
    expect(tooLong.status).toBe(400);
    expect(await tooLong.json()).toMatchObject({ error: "Invalid request body", issues: [expect.objectContaining({ path: ["codeSnippet"] })] });
    expect(analyzeWriting()).not.toHaveBeenCalled();
  });
});
