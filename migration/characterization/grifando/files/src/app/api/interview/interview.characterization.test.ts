// Characterization of the interview routes at the Grifando baseline (src/app/api/interview/**),
// none of which has a test: starting a session, reading it, answering a turn and ending it.
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

import { POST as postEnd } from "@/app/api/interview/[id]/end/route";
import { GET as getSession } from "@/app/api/interview/[id]/route";
import { POST as postAnswer } from "@/app/api/interview/[id]/turns/[turnId]/answer/route";
import { POST as postStart } from "@/app/api/interview/route";

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

async function start() {
  const response = await postStart(json("POST", undefined, AI_HEADERS));
  return { response, body: (await response.json()) as { sessionId: string; turn: { id: string } } };
}

describe("interview routes", () => {
  it("starts a session with its opening question", async () => {
    const { response, body } = await start();
    expect(response.status).toBe(201);
    expect(body).toEqual({
      sessionId: expect.any(String),
      turn: { id: expect.any(String), question: "What did you work on recently?", order: 0 },
    });
    const withoutKey = await postStart(json("POST", undefined));
    expect(withoutKey.status).toBe(401);
    expect(await withoutKey.json()).toMatchObject({ code: "AI_KEY_REQUIRED" });
  });

  it("reads a session with its turns, and 404s for an unknown or another user's session", async () => {
    const { body } = await start();
    const read = await getSession(json("GET", undefined), params({ id: body.sessionId }));
    expect(read.status).toBe(200);
    expect(await read.json()).toEqual({
      id: body.sessionId,
      status: "ACTIVE",
      turns: [{ id: body.turn.id, question: "What did you work on recently?", userAnswer: null, order: 0, analysis: null }],
    });

    holder.userId = "other-user";
    const foreign = await getSession(json("GET", undefined), params({ id: body.sessionId }));
    const unknown = await getSession(json("GET", undefined), params({ id: "missing" }));
    expect([foreign.status, unknown.status]).toEqual([404, 404]);
    expect(await foreign.json()).toEqual({ error: "Not found" });
  });

  it("answers a turn with its analysis and the next question", async () => {
    const { body } = await start();
    const response = await postAnswer(
      json("POST", { answer: "I work in a payments API." }, AI_HEADERS),
      params({ id: body.sessionId, turnId: body.turn.id }),
    );
    expect(response.status).toBe(200);
    const answered = (await response.json()) as { status: string; analysis: unknown; nextTurn: unknown };
    expect(answered.status).toBe("answered");
    expect(answered.nextTurn).toEqual({ id: expect.any(String), question: "What did you work on recently?", order: 1 });
    expect(keys(answered.analysis)).toBe("clarityScore, correctedText, createdAt, grammarScore, id, modelId, naturalText, naturalnessScore, occurrences, overallFeedback, sessionId, technicalCommunicationScore, vocabularyScore");
  });

  it("returns the FAILED writing session when the analysis fails, and validates the answer", async () => {
    const { body } = await start();
    holder.provider = { ...fakeProvider(), analyzeWriting: vi.fn(async () => { throw new Error("private cause"); }) };
    const failed = await postAnswer(
      json("POST", { answer: "I work in a payments API." }, AI_HEADERS),
      params({ id: body.sessionId, turnId: body.turn.id }),
    );
    expect(failed.status).toBe(200);
    expect(await failed.json()).toEqual({ status: "failed", message: expect.any(String), sessionId: expect.any(String) });

    const empty = await postAnswer(json("POST", { answer: "" }, AI_HEADERS), params({ id: body.sessionId, turnId: body.turn.id }));
    expect(empty.status).toBe(400);
    expect(await empty.json()).toMatchObject({ error: "Invalid request body", issues: [expect.any(Object)] });
  });

  it("answers 404 to another user's turn", async () => {
    const { body } = await start();
    holder.userId = "other-user";
    const response = await postAnswer(
      json("POST", { answer: "I work in a payments API." }, AI_HEADERS),
      params({ id: body.sessionId, turnId: body.turn.id }),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  });

  it("ends a session once, and 404s for an unknown or another user's session", async () => {
    const { body } = await start();
    const ended = await postEnd(json("POST", undefined), params({ id: body.sessionId }));
    expect(ended.status).toBe(200);
    expect(await ended.json()).toEqual({ status: "ended" });

    holder.userId = "other-user";
    const foreign = await postEnd(json("POST", undefined), params({ id: body.sessionId }));
    const unknown = await postEnd(json("POST", undefined), params({ id: "missing" }));
    expect([foreign.status, unknown.status]).toEqual([404, 404]);
    expect(await unknown.json()).toEqual({ error: "Not found" });
  });
});
