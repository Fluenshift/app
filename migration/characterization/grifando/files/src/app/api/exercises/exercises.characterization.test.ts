// Characterization of src/app/api/exercises/route.ts at the Grifando baseline: the status and
// body of GET and POST beyond the two AI error cases route.test.ts pins. The routes run against
// the test database; the session, the rate limit and the AI provider are faked, as the
// existing route tests fake them.
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

import { GET, POST } from "@/app/api/exercises/route";

const prisma = holder.prisma as ReturnType<typeof createPrismaClient>;
const AI_HEADERS = { "x-ai-provider": "gemini", "x-ai-key": "test-key" };

function post(body: unknown, headers: Record<string, string> = AI_HEADERS) {
  return new Request("http://test/api/exercises", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function multipleChoice() {
  return {
    type: "MULTIPLE_CHOICE" as const,
    instruction: "Choose the correct sentence.",
    explanation: "Use 'depend on', not 'depend of'.",
    options: ["I depend of this library.", "I depend on this library."],
    correctOptionIndex: 1,
  };
}

async function seedPattern(userId: string) {
  await prisma.user.upsert({ where: { id: userId }, create: { id: userId }, update: {} });
  return prisma.mistakePattern.create({
    data: {
      userId,
      category: "PREPOSITIONS",
      patternKey: "depend-on",
      exampleOriginal: "I depend of this library.",
      exampleCorrection: "I depend on this library.",
      occurrenceCount: 3,
    },
  });
}

beforeEach(async () => {
  vi.stubEnv("AI_PROVIDER", "");
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  holder.userId = "visitor-1";
  holder.provider = {
    analyzeWriting: vi.fn(),
    generateExercises: vi.fn(async () => [multipleChoice()]),
    continueInterview: vi.fn(),
    explainAttempt: vi.fn(),
  };
  await resetDatabase(prisma);
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await prisma.$disconnect();
});

describe("GET /api/exercises", () => {
  it("lists the visitor's pending exercises by their public view only", async () => {
    const empty = await GET();
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({ exercises: [] });

    const pattern = await seedPattern("visitor-1");
    await prisma.exercise.create({
      data: { userId: "visitor-1", type: "MULTIPLE_CHOICE", sourcePatternId: pattern.id, promptData: multipleChoice() },
    });
    await seedPattern("other-user").then((other) =>
      prisma.exercise.create({
        data: { userId: "other-user", type: "MULTIPLE_CHOICE", sourcePatternId: other.id, promptData: multipleChoice() },
      }),
    );

    const listed = await GET();
    expect(listed.status).toBe(200);
    expect(await listed.json()).toEqual({
      exercises: [
        {
          id: expect.any(String),
          type: "MULTIPLE_CHOICE",
          prompt: {
            type: "MULTIPLE_CHOICE",
            instruction: "Choose the correct sentence.",
            options: ["I depend of this library.", "I depend on this library."],
          },
        },
      ],
    });
  });
});

describe("GET /api/exercises pending", () => {
  it("drops an exercise once it has an attempt", async () => {
    const pattern = await seedPattern("visitor-1");
    const exercise = await prisma.exercise.create({
      data: { userId: "visitor-1", type: "MULTIPLE_CHOICE", sourcePatternId: pattern.id, promptData: multipleChoice() },
    });
    await prisma.exerciseAttempt.create({
      data: { exerciseId: exercise.id, userAnswer: "1", isCorrect: true, feedback: "Correct." },
    });

    expect(await (await GET()).json()).toEqual({ exercises: [] });
  });
});

describe("POST /api/exercises", () => {
  it("answers 400 with the validation issues for a malformed body", async () => {
    const response = await POST(post({ afterSessionId: "" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "Invalid request body", issues: [expect.any(Object)] });
  });

  it("answers 422 before the first mistake pattern exists", async () => {
    const response = await POST(post({}));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: "No mistake patterns yet — write something first to get personalized exercises.",
    });
  });

  it("answers 201 with the new exercises by their public view", async () => {
    await seedPattern("visitor-1");
    const response = await POST(post({}));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      exercises: [
        {
          id: expect.any(String),
          type: "MULTIPLE_CHOICE",
          prompt: {
            type: "MULTIPLE_CHOICE",
            instruction: "Choose the correct sentence.",
            options: ["I depend of this library.", "I depend on this library."],
          },
        },
      ],
    });
  });

  it("answers 500 with a generic message when generation fails unexpectedly", async () => {
    await seedPattern("visitor-1");
    holder.provider = { ...(holder.provider as object), generateExercises: vi.fn(async () => { throw new Error("private cause"); }) };
    const response = await POST(post({}));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Something went wrong. Please try again." });
  });
});
