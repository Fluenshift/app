// Characterization of src/server/domain/interview/interviewService.ts at the Grifando baseline,
// for fix commit 218b7b7 ("reuse the failed writing session on retry"): its tests pin the
// Writing Coach path; the interview answer path that passes the retry through has none. The AI
// provider is faked, as in interviewService.test.ts, and fails once. The second case pins the
// conversation each follow-up question is asked with, which interviewService.test.ts only counts.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AIProvider } from "@/server/ai/provider";
import { createTestPrismaClient, resetDatabase } from "@/server/db/test-utils";
import { createInterviewService } from "@/server/domain/interview/interviewService";

const prisma = createTestPrismaClient();
const userId = "test-user";

beforeEach(async () => {
  await resetDatabase(prisma);
  await prisma.user.create({
    data: { id: userId, email: "test@example.com", displayName: "Test User" },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

function fakeAnalysisResult() {
  return {
    correctedText: "I worked on a payments API.",
    naturalText: "I've been building a payments API.",
    overallFeedback: "Clear and professional.",
    scores: { grammar: 85, vocabulary: 80, clarity: 88, naturalness: 82, technicalCommunication: 90 },
    mistakes: [],
  };
}

describe("interviewService.answerTurn retry", () => {
  it("returns the FAILED writing session of a failed answer and re-analyzes that session on retry", async () => {
    const provider: AIProvider = {
      analyzeWriting: vi
        .fn()
        .mockRejectedValueOnce(new Error("model output was not valid JSON"))
        .mockResolvedValue(fakeAnalysisResult()),
      generateExercises: vi.fn(),
      continueInterview: vi.fn().mockResolvedValue({ question: "What did you work on recently?" }),
      explainAttempt: vi.fn(),
    };
    const service = createInterviewService({ prisma, aiProvider: provider, modelId: "test-model" });
    const { sessionId, turn } = await service.startInterview(userId);

    const failed = await service.answerTurn({ userId, sessionId, turnId: turn.id, answer: "I work in a payments API." });
    expect(failed.status).toBe("failed");
    const failedSessionId = failed.status === "failed" ? failed.sessionId : "";
    expect(failedSessionId).not.toBe("");

    const retried = await service.answerTurn({
      userId,
      sessionId,
      turnId: turn.id,
      answer: "I worked on a payments API.",
      retrySessionId: failedSessionId,
    });

    expect(retried.status).toBe("answered");
    const writingSessions = await prisma.writingSession.findMany({ where: { userId } });
    expect(writingSessions.map((session) => session.id)).toEqual([failedSessionId]);
    expect(writingSessions[0]?.originalText).toBe("I worked on a payments API.");
  });
});

describe("interviewService.answerTurn history", () => {
  it("asks each follow-up with every answered turn so far, in order", async () => {
    const continueInterview = vi
      .fn()
      .mockResolvedValueOnce({ question: "What did you work on recently?" })
      .mockResolvedValueOnce({ question: "What was the hardest part?" })
      .mockResolvedValueOnce({ question: "What would you change?" });
    const provider: AIProvider = {
      analyzeWriting: vi.fn().mockResolvedValue(fakeAnalysisResult()),
      generateExercises: vi.fn(),
      continueInterview,
      explainAttempt: vi.fn(),
    };
    const service = createInterviewService({ prisma, aiProvider: provider, modelId: "test-model" });
    const { sessionId, turn } = await service.startInterview(userId);

    const first = await service.answerTurn({ userId, sessionId, turnId: turn.id, answer: "A payments API." });
    if (first.status !== "answered") throw new Error("expected answered result");
    await service.answerTurn({ userId, sessionId, turnId: first.nextTurn.id, answer: "The retries." });

    expect(continueInterview.mock.calls).toEqual([
      [[]],
      [[{ question: "What did you work on recently?", answer: "A payments API." }]],
      [
        [
          { question: "What did you work on recently?", answer: "A payments API." },
          { question: "What was the hardest part?", answer: "The retries." },
        ],
      ],
    ]);
  });
});
