import type {
  Evaluation,
  ProgressEvidence,
  ProgressSummary,
} from "@fluenshift/contract";
import { afterEach, describe, expect, test } from "vitest";

import {
  createHttpAcademyClient,
  createHttpEvaluationClient,
  readDeployProfile,
} from "./api";
import { AcademyRequestError } from "./features/academy/academy-client";
import type { AcademyClient } from "./features/academy/academy-client";
import { EvaluationRequestError } from "./features/evaluations/evaluation-client";
import { MissingAIKeyError, saveAIKey } from "./features/settings/ai-key-store";

const retainedEvaluation: Evaluation = {
  band: "Natural",
  correctedText: "  Explain this code.\n",
  evaluatedAt: "2026-09-07T12:00:00.000Z",
  evaluatedEnglishWordCount: 3,
  findings: [],
  id: "retained-evaluation",
  model: "openai/gpt-5.6-terra",
  originalText: "  Explain this code.\n",
  provider: "OpenRouter",
  rubricVersion: "1",
  score: 100,
  suggestions: [],
  summary: "No errors found.",
};

const progressSummary: ProgressSummary = {
  averageBand: "Natural",
  averageScore: 100,
  categoryDistributions: [],
  categoryRecurrences: [],
  evaluatedEnglishWordCount: 3,
  evaluationCount: 1,
  findingCount: 0,
  findingRate: 0,
  incompatibleSegments: [],
  period: "30-days",
  recurringCorrections: [],
  rubricVersion: "1",
};

describe("HTTP Evaluation client", () => {
  test("maps a deleted or unknown Evaluation to missing", async () => {
    const client = createHttpEvaluationClient({
      fetch: () =>
        Promise.resolve(
          Response.json(
            { code: "NOT_FOUND", error: "Evaluation not found" },
            { status: 404 }
          )
        ),
    });

    expect(await client.getEvaluation("deleted")).toBeNull();
  });
  test("opens a retained Evaluation using an encoded identity", async () => {
    const client = createHttpEvaluationClient({
      fetch: (input) => {
        expect(input).toBe("/api/evaluations/a%2Fb%20%3F");
        return Promise.resolve(Response.json(retainedEvaluation));
      },
    });

    expect(await client.getEvaluation("a/b ?")).toEqual(retainedEvaluation);
  });
  test("submits exact writing and receives its durable Evaluation", async () => {
    const client = createHttpEvaluationClient({
      fetch: async (input, init) => {
        const request = new Request(
          new URL(String(input), "http://localhost"),
          init
        );
        expect(new URL(request.url).pathname).toBe("/api/evaluations");
        expect(request.method).toBe("POST");
        expect(request.headers.get("content-type")).toBe("application/json");
        expect(await request.json()).toEqual({
          writingSample: "  Explain this code.\n",
        });
        return Response.json(
          { evaluation: retainedEvaluation, kind: "created" },
          { status: 201 }
        );
      },
    });

    expect(await client.evaluateWriting("  Explain this code.\n")).toEqual({
      evaluation: retainedEvaluation,
      kind: "created",
    });
  });
  test("reads retained history from the same-origin API", async () => {
    const client = createHttpEvaluationClient({
      fetch: (input) => {
        expect(input).toBe("/api/evaluations");
        return Promise.resolve(
          Response.json([
            {
              band: "Clear",
              evaluatedAt: "2026-09-07T12:00:00.000Z",
              id: "retained-evaluation",
              rubricVersion: "1",
              score: 80,
              summary: "One article correction.",
            },
          ])
        );
      },
    });

    expect(await client.listEvaluations()).toEqual([
      {
        band: "Clear",
        evaluatedAt: "2026-09-07T12:00:00.000Z",
        id: "retained-evaluation",
        rubricVersion: "1",
        score: 80,
        summary: "One article correction.",
      },
    ]);
  });

  test("deletes exactly one encoded Evaluation identity", async () => {
    const client = createHttpEvaluationClient({
      fetch: (input, init) => {
        expect(input).toBe("/api/evaluations/a%2Fb");
        expect(init?.method).toBe("DELETE");
        return Promise.resolve(new Response(null, { status: 204 }));
      },
    });

    await expect(client.deleteEvaluation("a/b")).resolves.toBeUndefined();
  });

  test("loads Progress and encoded source evidence", async () => {
    const evidence: ProgressEvidence = {
      evaluations: [],
      findings: [],
      period: "all",
      rubricVersion: "1",
      selection: {
        correction: "does",
        kind: "correction",
        originalText: "do this?",
      },
    };
    const client = createHttpEvaluationClient({
      fetch: async (input, init) => {
        const url = new URL(String(input), "http://localhost");
        if (url.pathname === "/api/progress") {
          expect(url.searchParams.get("period")).toBe("30-days");
          return Response.json(progressSummary);
        }
        // ADR 0008: the selection travels in the body, out of the URL.
        const request = new Request(url, init);
        expect(url.pathname).toBe("/api/progress/evidence");
        expect(request.method).toBe("POST");
        expect(Object.fromEntries(url.searchParams)).toEqual({});
        expect(await request.json()).toEqual({
          period: "all",
          selection: {
            correction: "does",
            kind: "correction",
            originalText: "do this?",
          },
        });
        return Response.json(evidence);
      },
    });

    expect(await client.getProgressSummary({ period: "30-days" })).toEqual(
      progressSummary
    );
    expect(
      await client.getProgressEvidence({
        period: "all",
        selection: {
          correction: "does",
          kind: "correction",
          originalText: "do this?",
        },
      })
    ).toEqual(evidence);
  });

  test("preserves the no-English result returned with validation status", async () => {
    const client = createHttpEvaluationClient({
      fetch: () =>
        Promise.resolve(Response.json({ kind: "no-english" }, { status: 422 })),
    });

    expect(await client.evaluateWriting("Não há inglês.")).toEqual({
      kind: "no-english",
    });
  });

  test("raises safe typed errors for failed API operations", async () => {
    const client = createHttpEvaluationClient({
      fetch: () =>
        Promise.resolve(
          Response.json(
            {
              code: "provider-unavailable",
              error: "private-provider-cause",
              kind: "failure",
              retryable: true,
            },
            { status: 503 }
          )
        ),
    });

    const failure = await client
      .evaluateWriting("Private sample")
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(EvaluationRequestError);
    expect(failure).toMatchObject({
      code: "provider-unavailable",
      retryable: true,
      status: 503,
    });
    expect(String(failure)).not.toContain("private-provider-cause");
  });

  test("loads accurate server-side setup status", async () => {
    const status = {
      configured: true,
      dataLocation: "/data/local.db",
      model: "openai/gpt-5.6-terra",
      provider: "OpenRouter",
      rubricVersion: "1",
    };
    const client = createHttpEvaluationClient({
      fetch: (input) => {
        expect(input).toBe("/api/setup");
        return Promise.resolve(Response.json(status));
      },
    });

    expect(await client.getSetupStatus()).toEqual(status);
  });
});

describe("HTTP Evaluation client failures", () => {
  test("keeps a failure's code and retries one without a flag only from status 500", async () => {
    const answers = [
      new Response("Not Found", { status: 404 }),
      new Response("Bad Gateway", { status: 500 }),
      Response.json(
        { code: "not-ready", error: "History is not available" },
        { status: 503 }
      ),
    ];
    const failures = await Promise.all(
      answers.map((answer) =>
        createHttpEvaluationClient({ fetch: () => Promise.resolve(answer) })
          .listEvaluations()
          .catch((error: unknown) => error)
      )
    );

    expect(
      failures.map((failure) =>
        failure instanceof EvaluationRequestError
          ? {
              code: failure.code,
              retryable: failure.retryable,
              status: failure.status,
            }
          : failure
      )
    ).toEqual([
      { code: "request-failed", retryable: false, status: 404 },
      { code: "request-failed", retryable: true, status: 500 },
      { code: "not-ready", retryable: true, status: 503 },
    ]);
  });
});

describe("HTTP Evaluation client decoding", () => {
  test("refuses an answer the Evaluation contract does not describe", async () => {
    const client = createHttpEvaluationClient({
      fetch: () =>
        Promise.resolve(Response.json({ id: "retained-evaluation" })),
    });

    const failure = await client
      .getEvaluation("retained-evaluation")
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(EvaluationRequestError);
    expect(failure).toMatchObject({
      code: "request-failed",
      retryable: false,
      status: 200,
    });
  });
});

describe("HTTP Academy client", () => {
  test("reads today's challenge through the Academy contract", async () => {
    const challenge = {
      promptText:
        "Explain what an API is to someone with no programming background.",
      promptType: "DAILY_CHALLENGE",
    };
    const client = createHttpAcademyClient({
      fetch: (input) => {
        expect(input).toBe("/api/daily-challenge");
        return Promise.resolve(Response.json(challenge));
      },
    });

    expect(await client.getDailyChallenge()).toEqual(challenge);
  });

  test("refuses a challenge outside the Academy contract", async () => {
    const client = createHttpAcademyClient({
      fetch: () =>
        Promise.resolve(Response.json({ promptText: "Free writing" })),
    });

    await expect(client.getDailyChallenge()).rejects.toBeInstanceOf(
      AcademyRequestError
    );
  });
});

describe("Deploy Profile", () => {
  test("reads the Deploy Profile the server names", async () => {
    expect(
      await readDeployProfile({
        fetch: (input) => {
          expect(input).toBe("/api/deploy-profile");
          return Promise.resolve(Response.json({ deployProfile: "hosted" }));
        },
      })
    ).toBe("hosted");
  });

  test("reads a failed, refused or unknown answer as the local profile", async () => {
    const answers: (typeof globalThis.fetch)[] = [
      () => Promise.reject(new TypeError("Failed to fetch")),
      () =>
        Promise.resolve(
          Response.json({ deployProfile: "hosted" }, { status: 500 })
        ),
      () => Promise.resolve(Response.json({ deployProfile: "cloud" })),
    ];

    expect(
      await Promise.all(answers.map((fetch) => readDeployProfile({ fetch })))
    ).toStrictEqual(["local", "local", "local"]);
  });
});

interface SentRequest {
  readonly headers: Headers;
  readonly method: string;
  readonly path: string;
}

// A server that records each request's path and headers, then fails it, so every call is sent
// and none needs an answer.
const recordingFetch = () => {
  const requests: SentRequest[] = [];
  const fetch: typeof globalThis.fetch = (input, init) => {
    requests.push({
      headers: new Headers(init?.headers),
      method: init?.method ?? "GET",
      path: typeof input === "string" ? input : "not a path",
    });
    return Promise.resolve(
      Response.json({ code: "INTERNAL_ERROR" }, { status: 500 })
    );
  };
  return { fetch, requests };
};

// The key each request carried, by its path: provider and key, or nulls for none.
const keysByPath = (requests: readonly SentRequest[]) =>
  Object.fromEntries(
    requests.map(({ headers, path }) => [
      path,
      [headers.get("x-ai-provider"), headers.get("x-ai-key")],
    ])
  );

// A server that answers every request with one body.
const answering =
  (body: unknown): typeof globalThis.fetch =>
  () =>
    Promise.resolve(Response.json(body));

// The calls Grifando sent through aiFetch, its key test among them.
const trainerCalls = (client: AcademyClient) => [
  client.answerInterviewTurn("session-1", "turn-1", "I fixed the build."),
  client.explainAttempt("exercise-1", "attempt-1"),
  client.generateExercises({}),
  client.startInterview(),
  client.testAIKey(),
  client.writePractice("I depend on this library."),
];

// Every other call of the Academy client.
const otherCalls = (client: AcademyClient) => [
  client.createVocabularyItem({
    exampleSentence: "We shipped it on time.",
    meaningPt: "entregar",
    term: "ship",
  }),
  client.deleteVocabularyItem("item-1"),
  client.endInterview("session-1"),
  client.getAcademyDashboard(),
  client.getDailyChallenge(),
  client.getMistakeNotebook(),
  client.getSampleLimits(),
  client.listPendingExercises(),
  client.listVocabulary(),
  client.submitAttempt("exercise-1", "I depend on this library."),
];

// The browser's key travels only with the Trainer's calls, and only in the hosted profile
// (docs/adr/0012, docs/adr/0034).
describe("HTTP Academy client keys", () => {
  afterEach(() => {
    localStorage.clear();
  });

  test("sends the hosted profile's Trainer calls and key test with the browser's key", async () => {
    saveAIKey({ apiKey: "sk-ant-test", provider: "anthropic" });
    const { fetch, requests } = recordingFetch();

    await Promise.allSettled(
      trainerCalls(createHttpAcademyClient({ deployProfile: "hosted", fetch }))
    );

    expect(keysByPath(requests)).toStrictEqual({
      "/api/ai-key/test": ["anthropic", "sk-ant-test"],
      "/api/exercises": ["anthropic", "sk-ant-test"],
      "/api/exercises/exercise-1/attempts/attempt-1/explanation": [
        "anthropic",
        "sk-ant-test",
      ],
      "/api/interview": ["anthropic", "sk-ant-test"],
      "/api/interview/session-1/turns/turn-1/answer": [
        "anthropic",
        "sk-ant-test",
      ],
      "/api/practice-writing": ["anthropic", "sk-ant-test"],
    });
  });

  test("keeps the browser's key off every other hosted call", async () => {
    saveAIKey({ apiKey: "sk-ant-test", provider: "anthropic" });
    const { fetch, requests } = recordingFetch();

    await Promise.allSettled(
      otherCalls(createHttpAcademyClient({ deployProfile: "hosted", fetch }))
    );

    expect(requests).toHaveLength(10);
    expect(
      requests.filter(
        ({ headers }) => headers.has("x-ai-key") || headers.has("x-ai-provider")
      )
    ).toStrictEqual([]);
  });

  test("refuses a hosted Trainer call before any request when the browser holds no key", async () => {
    const { fetch, requests } = recordingFetch();
    const client = createHttpAcademyClient({ deployProfile: "hosted", fetch });

    await expect(client.generateExercises({})).rejects.toBeInstanceOf(
      MissingAIKeyError
    );
    expect(requests).toStrictEqual([]);
  });

  test("sends no key from the local profile, even one the browser holds", async () => {
    saveAIKey({ apiKey: "sk-ant-test", provider: "anthropic" });
    const { fetch, requests } = recordingFetch();

    await Promise.allSettled(
      trainerCalls(createHttpAcademyClient({ deployProfile: "local", fetch }))
    );

    expect(requests).toHaveLength(6);
    expect(
      requests.filter(
        ({ headers }) => headers.has("x-ai-key") || headers.has("x-ai-provider")
      )
    ).toStrictEqual([]);
  });

  test("reads the provider's verdict on the key, and refuses one outside the contract", async () => {
    saveAIKey({ apiKey: "AIza-test", provider: "gemini" });

    expect(
      await createHttpAcademyClient({
        deployProfile: "hosted",
        fetch: answering({ status: "busy" }),
      }).testAIKey()
    ).toBe("busy");
    await expect(
      createHttpAcademyClient({
        deployProfile: "hosted",
        fetch: answering({ status: "maybe" }),
      }).testAIKey()
    ).rejects.toBeInstanceOf(AcademyRequestError);
  });
});

// The key each request carried, by its method and path.
const keysByCall = (requests: readonly SentRequest[]) =>
  Object.fromEntries(
    requests.map(({ headers, method, path }) => [
      `${method} ${path}`,
      [headers.get("x-ai-provider"), headers.get("x-ai-key")],
    ])
  );

// The hosted Judge runs on the browser's OpenRouter key, which only the call that runs it carries
// (docs/adr/0035).
describe("HTTP Evaluation client keys", () => {
  afterEach(() => {
    localStorage.clear();
  });

  test("sends only the hosted profile's Evaluation with the browser's key", async () => {
    saveAIKey({ apiKey: "sk-or-test", provider: "openrouter" });
    const { fetch, requests } = recordingFetch();
    const client = createHttpEvaluationClient({
      deployProfile: "hosted",
      fetch,
    });

    await Promise.allSettled([
      client.evaluateWriting("I depend of this library."),
      client.listEvaluations(),
      client.getEvaluation("evaluation-1"),
      client.deleteEvaluation("evaluation-1"),
      client.getSetupStatus(),
    ]);

    expect(keysByCall(requests)).toStrictEqual({
      "DELETE /api/evaluations/evaluation-1": [null, null],
      "GET /api/evaluations": [null, null],
      "GET /api/evaluations/evaluation-1": [null, null],
      "GET /api/setup": [null, null],
      "POST /api/evaluations": ["openrouter", "sk-or-test"],
    });
  });

  test("refuses a hosted Evaluation before any request when the browser holds no key", async () => {
    const { fetch, requests } = recordingFetch();
    const client = createHttpEvaluationClient({
      deployProfile: "hosted",
      fetch,
    });

    await expect(
      client.evaluateWriting("I depend of this library.")
    ).rejects.toBeInstanceOf(MissingAIKeyError);
    expect(requests).toStrictEqual([]);
  });

  test("sends no key with the local profile's Evaluation", async () => {
    saveAIKey({ apiKey: "sk-or-test", provider: "openrouter" });
    const { fetch, requests } = recordingFetch();

    await Promise.allSettled([
      createHttpEvaluationClient({
        deployProfile: "local",
        fetch,
      }).evaluateWriting("I depend of this library."),
    ]);

    expect(keysByCall(requests)).toStrictEqual({
      "POST /api/evaluations": [null, null],
    });
  });
});

// A hosted Learner deletes themselves and all their data (`DELETE /api/me`): the call reaches no
// provider, so it carries no key (docs/adr/0003, docs/adr/0036).
describe("HTTP Academy client Learner deletion", () => {
  afterEach(() => {
    localStorage.clear();
  });

  test("sends the hosted Learner's deletion without the browser's key", async () => {
    saveAIKey({ apiKey: "sk-or-v1-test", provider: "openrouter" });
    const { fetch, requests } = recordingFetch();

    await Promise.allSettled([
      createHttpAcademyClient({
        deployProfile: "hosted",
        fetch,
      }).deleteLearner(),
    ]);

    expect(keysByCall(requests)).toStrictEqual({
      "DELETE /api/me": [null, null],
    });
  });

  test("resolves once the data is deleted, and keeps a refusal's status and message", async () => {
    const deleted = createHttpAcademyClient({
      deployProfile: "hosted",
      fetch: () => Promise.resolve(new Response(null, { status: 204 })),
    }).deleteLearner();
    const refused = createHttpAcademyClient({
      deployProfile: "hosted",
      fetch: () =>
        Promise.resolve(
          Response.json(
            { error: "You're going a bit fast. Wait a moment and try again." },
            { status: 429 }
          )
        ),
    }).deleteLearner();

    await expect(deleted).resolves.toBeUndefined();
    await expect(refused).rejects.toMatchObject({
      serverMessage: "You're going a bit fast. Wait a moment and try again.",
      status: 429,
    });
  });
});

// Explain code sends its snippet beside the explanation; free writing sends none (docs/adr/0038).
describe("HTTP Academy client Explain code", () => {
  test("sends Explain code's snippet with its explanation, and no snippet without one", async () => {
    const bodies: unknown[] = [];
    const fetch: typeof globalThis.fetch = (_input, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return Promise.resolve(
        Response.json({ code: "INTERNAL_ERROR" }, { status: 500 })
      );
    };
    const client = createHttpAcademyClient({ fetch });

    await Promise.allSettled([
      client.writePractice("I explain this code.", "export const a = 1;"),
      client.writePractice("I write freely."),
    ]);

    expect(bodies).toStrictEqual([
      {
        codeSnippet: "export const a = 1;",
        writingSample: "I explain this code.",
      },
      { writingSample: "I write freely." },
    ]);
  });
});
