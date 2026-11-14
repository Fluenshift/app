// Characterization of src/app/api/exercises/[id]/attempts/route.ts and its explanation route
// at the Grifando baseline, neither of which has a test: grading an attempt, and explaining it.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { createPrismaClient } from "@/server/db/client";
import { resetDatabase } from "@/server/db/test-utils";
import { AIQuotaExceededError, AIResponseValidationError } from "@/server/ai/errors";

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

import { POST as postExplanation } from "@/app/api/exercises/[id]/attempts/[attemptId]/explanation/route";
import { POST as postAttempt } from "@/app/api/exercises/[id]/attempts/route";

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

afterAll(async () => {
  vi.unstubAllEnvs();
  await prisma.$disconnect();
});

const exercisePrompt = {
  type: "MULTIPLE_CHOICE" as const,
  instruction: "Choose the correct sentence.",
  explanation: "Use 'depend on', not 'depend of'.",
  options: ["I depend of this library.", "I depend on this library."],
  correctOptionIndex: 1,
};

async function seedExercise(userId: string) {
  await seedUser(userId);
  const pattern = await prisma.mistakePattern.create({
    data: {
      userId,
      category: "PREPOSITIONS",
      patternKey: "depend-on",
      exampleOriginal: "I depend of this library.",
      exampleCorrection: "I depend on this library.",
      occurrenceCount: 3,
    },
  });
  return prisma.exercise.create({
    data: { userId, type: "MULTIPLE_CHOICE", sourcePatternId: pattern.id, promptData: exercisePrompt },
  });
}

beforeEach(async () => {
  vi.stubEnv("AI_PROVIDER", "");
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  holder.userId = "visitor-1";
  holder.provider = {
    analyzeWriting: vi.fn(),
    generateExercises: vi.fn(),
    continueInterview: vi.fn(),
    explainAttempt: vi.fn(async () => ({ explanation: "'Depend' takes 'on'." })),
  };
  await resetDatabase(prisma);
});

describe("POST /api/exercises/[id]/attempts", () => {
  it("grades an answer and returns the attempt with the whole exercise", async () => {
    const exercise = await seedExercise("visitor-1");
    const response = await postAttempt(json("POST", { answer: "1" }), params({ id: exercise.id }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      attemptId: expect.any(String),
      isCorrect: true,
      explanation: "Use 'depend on', not 'depend of'.",
      exercise: exercisePrompt,
    });
  });

  it("answers 400 with the validation issues for an empty answer", async () => {
    const exercise = await seedExercise("visitor-1");
    const response = await postAttempt(json("POST", { answer: "  " }), params({ id: exercise.id }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "Invalid request body", issues: [expect.any(Object)] });
  });

  it("answers 404 for an unknown exercise and for another user's", async () => {
    const other = await seedExercise("other-user");
    const unknown = await postAttempt(json("POST", { answer: "1" }), params({ id: "missing" }));
    const foreign = await postAttempt(json("POST", { answer: "1" }), params({ id: other.id }));
    expect([unknown.status, foreign.status]).toEqual([404, 404]);
    expect(await foreign.json()).toEqual({ error: "Not found" });
  });
});

describe("POST /api/exercises/[id]/attempts/[attemptId]/explanation", () => {
  async function seedAttempt() {
    const exercise = await seedExercise("visitor-1");
    const graded = await postAttempt(json("POST", { answer: "0" }), params({ id: exercise.id }));
    const { attemptId } = (await graded.json()) as { attemptId: string };
    return { exerciseId: exercise.id, attemptId };
  }

  it("explains an attempt with the provider's text", async () => {
    const ids = await seedAttempt();
    const response = await postExplanation(json("POST", undefined, AI_HEADERS), params({ id: ids.exerciseId, attemptId: ids.attemptId }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ explanation: "'Depend' takes 'on'." });
  });

  it("answers 401 AI_KEY_REQUIRED without a key and 404 for an unknown attempt", async () => {
    const ids = await seedAttempt();
    const withoutKey = await postExplanation(json("POST", undefined), params({ id: ids.exerciseId, attemptId: ids.attemptId }));
    const unknown = await postExplanation(json("POST", undefined, AI_HEADERS), params({ id: ids.exerciseId, attemptId: "missing" }));
    expect(withoutKey.status).toBe(401);
    expect(await withoutKey.json()).toMatchObject({ code: "AI_KEY_REQUIRED" });
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: "Not found" });
  });

  it("keeps the grade and answers 502, 500 or the AI code when the explanation fails", async () => {
    const ids = await seedAttempt();
    const explainWith = async (error: Error) => {
      holder.provider = { ...(holder.provider as object), explainAttempt: vi.fn(async () => { throw error; }) };
      const response = await postExplanation(json("POST", undefined, AI_HEADERS), params({ id: ids.exerciseId, attemptId: ids.attemptId }));
      return { status: response.status, body: await response.json() };
    };
    const failed = "We couldn't explain this answer right now. Your grade is unaffected — try again.";

    expect(await explainWith(new AIResponseValidationError("bad shape", []))).toEqual({ status: 502, body: { error: failed } });
    expect(await explainWith(new Error("private cause"))).toEqual({ status: 500, body: { error: failed } });
    expect(await explainWith(new AIQuotaExceededError())).toMatchObject({ status: 429, body: { code: "AI_QUOTA_EXCEEDED" } });
  });
});
