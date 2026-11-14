// Characterization of the writing session routes at the Grifando baseline beyond the two
// missing-key cases route.test.ts pins: submitting a text, listing sessions and reading one.
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

import { GET as getSession } from "@/app/api/writing-sessions/[id]/route";
import { GET as listSessions, POST as postSession } from "@/app/api/writing-sessions/route";

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

const submission = { promptType: "FREE", originalText: "I work in a payments API." };

describe("writing session routes", () => {
  it("analyzes a submitted text and answers 201 with the session and its analysis", async () => {
    const response = await postSession(json("POST", submission, AI_HEADERS));
    expect(response.status).toBe(201);
    const body = (await response.json()) as { status: string; session: Record<string, unknown> & { analysis: Record<string, unknown> & { occurrences: unknown[] } } };
    expect(body.status).toBe("analyzed");
    expect(body.session).toMatchObject({ userId: "visitor-1", promptType: "FREE", originalText: "I work in a payments API.", status: "ANALYZED" });
    expect(keys(body.session)).toBe("analysis, createdAt, id, originalText, promptText, promptType, status, technicalCategory, userId");
    expect(keys(body.session.analysis)).toBe("clarityScore, correctedText, createdAt, grammarScore, id, modelId, naturalText, naturalnessScore, occurrences, overallFeedback, sessionId, technicalCommunicationScore, vocabularyScore");
    expect(keys(body.session.analysis.occurrences[0])).toBe("analysisId, category, correctedSpan, createdAt, example, explanation, id, l1Transfer, originalSpan, patternId, severity");
  });

  it("answers 201 with the FAILED session when the analysis fails", async () => {
    holder.provider = { ...fakeProvider(), analyzeWriting: vi.fn(async () => { throw new Error("private cause"); }) };
    const response = await postSession(json("POST", submission, AI_HEADERS));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ status: "failed", sessionId: expect.any(String), message: expect.any(String) });
  });

  it("answers 400 with the validation issues for an unknown prompt type", async () => {
    const response = await postSession(json("POST", { ...submission, promptType: "ESSAY" }, AI_HEADERS));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "Invalid request body", issues: [expect.any(Object)] });
  });

  it("lists the visitor's sessions newest first, without their analyses", async () => {
    await postSession(json("POST", { ...submission, originalText: "First text." }, AI_HEADERS));
    await postSession(json("POST", { ...submission, originalText: "Second text." }, AI_HEADERS));
    holder.userId = "other-user";
    await postSession(json("POST", { ...submission, originalText: "Someone else's text." }, AI_HEADERS));
    holder.userId = "visitor-1";

    const response = await listSessions();
    expect(response.status).toBe(200);
    const sessions = (await response.json()) as Record<string, unknown>[];
    expect(sessions.map((session) => session.originalText)).toEqual(["Second text.", "First text."]);
    expect(keys(sessions[0])).toBe("createdAt, id, originalText, promptText, promptType, status, technicalCategory, userId");
  });

  it("lists at most the 20 newest sessions", async () => {
    await seedUser("visitor-1");
    for (let index = 0; index < 21; index += 1) {
      await prisma.writingSession.create({
        data: {
          userId: "visitor-1",
          promptType: "FREE",
          originalText: `Text ${index}.`,
          createdAt: new Date(Date.UTC(2026, 9, 1, 0, index)),
        },
      });
    }

    const sessions = (await (await listSessions()).json()) as { originalText: string }[];
    expect(sessions).toHaveLength(20);
    expect(sessions[0]?.originalText).toBe("Text 20.");
    expect(sessions.at(-1)?.originalText).toBe("Text 1.");
  });

  it("reads one session with its analysis, and 404s for an unknown or another user's session", async () => {
    const created = (await (await postSession(json("POST", submission, AI_HEADERS))).json()) as { session: { id: string } };
    const read = await getSession(json("GET", undefined), params({ id: created.session.id }));
    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({ id: created.session.id, analysis: { correctedText: "I worked on a payments API." } });

    holder.userId = "other-user";
    const foreign = await getSession(json("GET", undefined), params({ id: created.session.id }));
    const unknown = await getSession(json("GET", undefined), params({ id: "missing" }));
    expect([foreign.status, unknown.status]).toEqual([404, 404]);
    expect(await foreign.json()).toEqual({ error: "Not found" });
  });
});
