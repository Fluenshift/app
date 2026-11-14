// Characterization of the API route handlers at the Grifando baseline, for fix commit 9ba8040
// ("rate-limit before creating users"): its test pins the proxy's half of the fix, not that
// every state-changing route consults its rate limit before it creates the visitor's user.
// The rate limit is faked to refuse, as the existing route tests fake it to allow.
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureUser: vi.fn(async () => undefined),
  buckets: [] as string[],
}));

vi.mock("@/server/db/client", () => ({ prisma: {} }));
vi.mock("@/server/session/currentUser", () => ({
  getCurrentUserId: vi.fn(async () => "visitor-1"),
  ensureUser: mocks.ensureUser,
}));
vi.mock("@/server/rateLimit", () => ({
  rateLimitResponse: async (_prisma: unknown, _request: Request, _userId: string, bucket: string) => {
    mocks.buckets.push(bucket);
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  },
}));

import { POST as postKeyTest } from "@/app/api/ai-key/test/route";
import { POST as postExplanation } from "@/app/api/exercises/[id]/attempts/[attemptId]/explanation/route";
import { POST as postAttempt } from "@/app/api/exercises/[id]/attempts/route";
import { POST as postExercises } from "@/app/api/exercises/route";
import { POST as postInterviewEnd } from "@/app/api/interview/[id]/end/route";
import { POST as postInterviewAnswer } from "@/app/api/interview/[id]/turns/[turnId]/answer/route";
import { POST as postInterview } from "@/app/api/interview/route";
import { DELETE as deleteMe } from "@/app/api/me/route";
import { DELETE as deleteVocabularyItem } from "@/app/api/vocabulary/[id]/route";
import { POST as postVocabulary } from "@/app/api/vocabulary/route";
import { POST as postWritingSession } from "@/app/api/writing-sessions/route";

const AI_HEADERS = { "x-ai-provider": "gemini", "x-ai-key": "test-key" };

function request(method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request("http://test/api/route", {
    method,
    headers: { "content-type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function params<T extends Record<string, string>>(values: T) {
  return { params: Promise.resolve(values) } as never;
}

beforeEach(() => {
  vi.stubEnv("AI_PROVIDER", "");
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  mocks.ensureUser.mockClear();
  mocks.buckets.length = 0;
});

describe("rate limit before the user", () => {
  it("refuses every state-changing route at its rate limit before creating the visitor's user", async () => {
    const calls: [string, () => Promise<Response>][] = [
      ["POST /api/ai-key/test", () => postKeyTest(request("POST", {}, AI_HEADERS))],
      [
        "POST /api/exercises/[id]/attempts/[attemptId]/explanation",
        () => postExplanation(request("POST", {}, AI_HEADERS), params({ id: "exercise-1", attemptId: "attempt-1" })),
      ],
      [
        "POST /api/exercises/[id]/attempts",
        () => postAttempt(request("POST", { answer: "I depend on it." }), params({ id: "exercise-1" })),
      ],
      ["POST /api/exercises", () => postExercises(request("POST", {}, AI_HEADERS))],
      ["POST /api/interview/[id]/end", () => postInterviewEnd(request("POST"), params({ id: "interview-1" }))],
      [
        "POST /api/interview/[id]/turns/[turnId]/answer",
        () =>
          postInterviewAnswer(
            request("POST", { answer: "I would split the service." }, AI_HEADERS),
            params({ id: "interview-1", turnId: "turn-1" }),
          ),
      ],
      ["POST /api/interview", () => postInterview(request("POST", {}, AI_HEADERS))],
      ["DELETE /api/me", () => deleteMe(request("DELETE"))],
      ["DELETE /api/vocabulary/[id]", () => deleteVocabularyItem(request("DELETE"), params({ id: "item-1" }))],
      [
        "POST /api/vocabulary",
        () =>
          postVocabulary(
            request("POST", { term: "rely on", meaningPt: "depender de", exampleSentence: "I rely on tests." }),
          ),
      ],
      [
        "POST /api/writing-sessions",
        () =>
          postWritingSession(request("POST", { promptType: "FREE", originalText: "I depend of this library." }, AI_HEADERS)),
      ],
    ];

    const statuses: Record<string, number> = {};
    for (const [name, call] of calls) {
      statuses[name] = (await call()).status;
    }

    expect(statuses).toEqual(Object.fromEntries(calls.map(([name]) => [name, 429])));
    expect(mocks.buckets).toEqual([
      "keyTest",
      "analysis",
      "write",
      "generation",
      "write",
      "analysis",
      "generation",
      "write",
      "write",
      "write",
      "analysis",
    ]);
    expect(mocks.ensureUser).not.toHaveBeenCalled();
  });
});
