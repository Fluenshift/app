// Characterization of apps/server/src/app.ts at the PE baseline: the status, body and headers
// of every endpoint that app.test.ts leaves out. Each endpoint gets its boundary callbacks as
// plain fakes, as app.test.ts does, so no model or database runs.
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createApp } from "./app";
import type { AppOptions, EvaluationEndpointResult, SetupStatus } from "./app";

let webDistPath = "";

beforeAll(async () => {
  webDistPath = await mkdtemp(path.join(tmpdir(), "prompt-evolution-web-"));
  await mkdir(path.join(webDistPath, "assets"));
  await writeFile(
    path.join(webDistPath, "index.html"),
    "<main>Prompt Evolution</main>"
  );
  await writeFile(path.join(webDistPath, "assets", "app-123.js"), "export {};");
  await writeFile(path.join(webDistPath, "secret.txt"), "outside the assets");
});

afterAll(async () => {
  await rm(webDistPath, { force: true, recursive: true });
});

const setup: SetupStatus = {
  configured: true,
  dataLocation: "/data/local.db",
  model: "openai/gpt-5.6-terra",
  provider: "OpenRouter",
  rubricVersion: "1",
};

const appWith = (options: Partial<AppOptions> = {}) =>
  createApp({ serveWeb: false, webDistPath, ...options });

const get = (url: string, headers: Record<string, string> = {}) =>
  new Request(url, { headers });

const postSample = (
  body: string,
  headers: Record<string, string> = {}
) =>
  new Request("http://localhost/api/evaluations", {
    body,
    headers: { "content-type": "application/json", ...headers },
    method: "POST",
  });

const sampleBody = JSON.stringify({ writingSample: "A short sample." });

const created = (writingSample: string): EvaluationEndpointResult => ({
  evaluation: {
    band: "Natural",
    correctedText: writingSample,
    evaluatedAt: "2026-09-07T12:00:00.000Z",
    evaluatedEnglishWordCount: 3,
    findings: [],
    id: "evaluation-1",
    model: "test-model",
    originalText: writingSample,
    provider: "test",
    rubricVersion: "1",
    score: 100,
    suggestions: [],
    summary: "Clear writing.",
  },
  kind: "created",
});

describe("API errors", () => {
  it("answers an unknown API route with a not-found code", async () => {
    const response = await appWith().handle(
      get("http://localhost/api/missing")
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({
      code: "not-found",
      error: "Not Found",
    });
  });

  it("answers a body that is not JSON with an invalid-request code", async () => {
    const response = await appWith({
      evaluateWriting: () => Promise.reject(new Error("must not be called")),
    }).handle(postSample("{"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: "invalid-request",
      error: "Request could not be completed",
    });
  });

  it("answers a body without a writingSample with an invalid-request code", async () => {
    const response = await appWith({
      evaluateWriting: () => Promise.reject(new Error("must not be called")),
    }).handle(postSample(JSON.stringify({ sample: "A short sample." })));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: "invalid-request",
      error: "Request could not be completed",
    });
  });
});

describe("request guards", () => {
  it("accepts the three loopback host names", async () => {
    const app = appWith();
    const statuses = await Promise.all(
      ["http://localhost", "http://127.0.0.1", "http://[::1]"].map(
        async (origin) =>
          (await app.handle(get(`${origin}/api/health`))).status
      )
    );

    expect(statuses).toEqual([200, 200, 200]);
  });

  it("forbids a remote host, a foreign Host header, a cross-site fetch and a foreign Origin alike", async () => {
    const evaluated: string[] = [];
    const app = appWith({
      evaluateWriting: (writingSample) => {
        evaluated.push(writingSample);
        return Promise.resolve({ kind: "no-english" });
      },
    });
    const responses = await Promise.all([
      app.handle(
        new Request("http://attacker.example/api/evaluations", {
          body: sampleBody,
          headers: { "content-type": "application/json" },
          method: "POST",
        })
      ),
      app.handle(postSample(sampleBody, { host: "attacker.example" })),
      app.handle(postSample(sampleBody, { "sec-fetch-site": "cross-site" })),
      app.handle(postSample(sampleBody, { origin: "http://localhost:5173" })),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(403);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({
        code: "forbidden",
        error: "Only same-origin localhost access is allowed",
      });
    }
    expect(evaluated).toEqual([]);
  });

  it("allows a same-origin fetch that names its own Origin and Host", async () => {
    const response = await appWith().handle(
      get("http://localhost:3000/api/health", {
        host: "localhost:3000",
        origin: "http://localhost:3000",
        "sec-fetch-site": "same-origin",
      })
    );

    expect(response.status).toBe(200);
  });

  it("allows a declared body of exactly 256 KiB and refuses one byte more", async () => {
    const limit = 256 * 1024;
    const evaluated: number[] = [];
    const app = appWith({
      evaluateWriting: (writingSample) => {
        evaluated.push(writingSample.length);
        return Promise.resolve({ kind: "no-english" });
      },
    });
    const atLimit = JSON.stringify({
      writingSample: "a".repeat(limit - '{"writingSample":""}'.length),
    });
    const accepted = await app.handle(
      postSample(atLimit, { "content-length": String(limit) })
    );
    const refused = await app.handle(
      postSample(sampleBody, { "content-length": String(limit + 1) })
    );

    expect(accepted.status).toBe(422);
    expect(evaluated).toEqual([limit - '{"writingSample":""}'.length]);
    expect(refused.status).toBe(413);
    expect(refused.headers.get("cache-control")).toBe("no-store");
    expect(await refused.json()).toEqual({
      code: "sample-too-large",
      error: "Writing Sample is too large",
    });
  });
});

describe("Evaluation endpoint", () => {
  it("answers 503 with a correlation ID when Evaluation is not configured", async () => {
    const response = await appWith().handle(postSample(sampleBody));

    expect(response.status).toBe(503);
    expect(response.headers.get("x-correlation-id")).toMatch(
      /^[0-9a-f-]{36}$/u
    );
    expect(await response.json()).toEqual({
      error: "Evaluation is not configured",
    });
  });

  it("returns a created Evaluation whole", async () => {
    const response = await appWith({
      evaluateWriting: (writingSample) =>
        Promise.resolve(created(writingSample)),
    }).handle(postSample(sampleBody));

    expect(response.status).toBe(201);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual(created("A short sample."));
  });

  it("returns no-english as its kind alone", async () => {
    const response = await appWith({
      evaluateWriting: () => Promise.resolve({ kind: "no-english" }),
    }).handle(postSample(sampleBody));

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ kind: "no-english" });
  });

  it("returns each typed failure as its code, kind and retryable flag", async () => {
    const failures = [
      { code: "configuration-missing", retryable: false },
      { code: "invalid-assessment", retryable: true },
      { code: "invalid-writing-sample", retryable: false },
      { code: "persistence-failure", retryable: true },
      { code: "provider-credits-exhausted", retryable: false },
      { code: "provider-output-incomplete", retryable: true },
      { code: "provider-rate-limited", retryable: true },
      { code: "provider-rejected", retryable: true },
      { code: "provider-timeout", retryable: true },
      { code: "provider-unavailable", retryable: true },
    ] as const;
    const bodies = await Promise.all(
      failures.map(async ({ code, retryable }) => {
        const response = await appWith({
          evaluateWriting: () =>
            Promise.resolve({ code, kind: "failure", retryable }),
        }).handle(postSample(sampleBody));
        return response.json();
      })
    );

    expect(bodies).toEqual(
      failures.map(({ code, retryable }) => ({
        code,
        kind: "failure",
        retryable,
      }))
    );
  });

  it("logs internal-error and answers a safe 500 when evaluation throws", async () => {
    const events: { readonly code: string }[] = [];
    const response = await appWith({
      evaluateWriting: () => Promise.reject(new Error("private-cause")),
      logEvaluation: (event) => {
        events.push(event);
      },
    }).handle(postSample(sampleBody));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      code: "internal-error",
      error: "Request could not be completed",
    });
    expect(events.map((event) => event.code)).toEqual(["internal-error"]);
  });

  it("keeps the outcome when logging throws", async () => {
    const response = await appWith({
      evaluateWriting: () => Promise.resolve({ kind: "no-english" }),
      logEvaluation: () => {
        throw new Error("logger down");
      },
    }).handle(postSample(sampleBody));

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ kind: "no-english" });
  });

  it("logs the configured model and provider with whole milliseconds", async () => {
    const events: {
      readonly durationMilliseconds: number;
      readonly model: string;
      readonly provider: string;
    }[] = [];
    await appWith({
      evaluateWriting: (writingSample) =>
        Promise.resolve(created(writingSample)),
      logEvaluation: (event) => {
        events.push(event);
      },
      setup,
    }).handle(postSample(sampleBody));

    expect(events).toHaveLength(1);
    expect(events[0]?.model).toBe("openai/gpt-5.6-terra");
    expect(events[0]?.provider).toBe("OpenRouter");
    expect(Number.isInteger(events[0]?.durationMilliseconds)).toBe(true);
  });
});

describe("History endpoints", () => {
  it("answers 503 not-ready when History is unavailable", async () => {
    const app = appWith();
    const responses = await Promise.all([
      app.handle(get("http://localhost/api/evaluations")),
      app.handle(get("http://localhost/api/evaluations/evaluation-1")),
      app.handle(
        new Request("http://localhost/api/evaluations/evaluation-1", {
          method: "DELETE",
        })
      ),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        code: "not-ready",
        error: "History is not available",
      });
    }
  });

  it("answers a missing Evaluation with a not-found code", async () => {
    const response = await appWith({
      getEvaluation: () => Promise.resolve(null),
    }).handle(get("http://localhost/api/evaluations/missing"));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      code: "not-found",
      error: "Evaluation not found",
    });
  });

  it("answers a deletion with an empty 204", async () => {
    const response = await appWith({
      deleteEvaluation: () => Promise.resolve(),
    }).handle(
      new Request("http://localhost/api/evaluations/evaluation-1", {
        method: "DELETE",
      })
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });
});

describe("Progress endpoints", () => {
  const summary = ({ period }: { period: string }) =>
    Promise.resolve({ evaluationCount: 0, period });
  const evidence = ({
    period,
    selection,
  }: {
    period: string;
    selection: unknown;
  }) => Promise.resolve({ period, selection });

  it("answers 503 not-ready when Progress is unavailable", async () => {
    const app = appWith();
    const responses = await Promise.all([
      app.handle(get("http://localhost/api/progress?period=all")),
      app.handle(
        get(
          "http://localhost/api/progress/evidence?period=all&insight=finding-rate"
        )
      ),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        code: "not-ready",
        error: "Progress is not available",
      });
    }
  });

  it("accepts exactly the 7-days, 30-days and all periods", async () => {
    const app = appWith({ getProgressSummary: summary });
    const accepted = await Promise.all(
      ["7-days", "30-days", "all"].map(async (period) =>
        (
          await app.handle(
            get(`http://localhost/api/progress?period=${period}`)
          )
        ).json()
      )
    );
    const refused = await Promise.all(
      [
        "http://localhost/api/progress",
        "http://localhost/api/progress?period=90-days",
        "http://localhost/api/progress?period=All",
      ].map((url) => app.handle(get(url)))
    );

    expect(accepted).toEqual([
      { evaluationCount: 0, period: "7-days" },
      { evaluationCount: 0, period: "30-days" },
      { evaluationCount: 0, period: "all" },
    ]);
    for (const response of refused) {
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        code: "invalid-period",
        error: "Progress period is invalid",
      });
    }
  });

  it("selects evidence by insight, Error Category or correction", async () => {
    const app = appWith({ getProgressEvidence: evidence });
    const selections = await Promise.all(
      [
        "period=7-days&insight=finding-rate",
        "period=30-days&insight=average-score",
        "period=all&insight=category&category=Verb%20form%2Ftense",
        "period=all&insight=correction&originalText=a%20apple&correction=an%20apple",
      ].map(async (query) =>
        (
          await app.handle(
            get(`http://localhost/api/progress/evidence?${query}`)
          )
        ).json()
      )
    );

    expect(selections).toEqual([
      { period: "7-days", selection: { kind: "finding-rate" } },
      { period: "30-days", selection: { kind: "average-score" } },
      {
        period: "all",
        selection: { category: "Verb form/tense", kind: "category" },
      },
      {
        period: "all",
        selection: {
          correction: "an apple",
          kind: "correction",
          originalText: "a apple",
        },
      },
    ]);
  });

  it("refuses an unknown insight, an unknown category, a half correction and a bad period", async () => {
    const app = appWith({ getProgressEvidence: evidence });
    const responses = await Promise.all(
      [
        "period=all&insight=improvement",
        "period=all&insight=category&category=Style",
        "period=all&insight=correction&originalText=a%20apple",
        "period=year&insight=finding-rate",
        "period=all",
      ].map((query) =>
        app.handle(get(`http://localhost/api/progress/evidence?${query}`))
      )
    );

    for (const response of responses) {
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        code: "invalid-selection",
        error: "Progress selection is invalid",
      });
    }
  });
});

describe("Setup endpoint", () => {
  it("answers 503 not-ready without a setup status", async () => {
    const response = await appWith().handle(get("http://localhost/api/setup"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      code: "not-ready",
      error: "Setup status is not available",
    });
  });

  it("returns the setup status whole", async () => {
    const response = await appWith({ setup }).handle(
      get("http://localhost/api/setup")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual(setup);
  });
});

describe("browser fallback", () => {
  const webApp = () => createApp({ serveWeb: true, webDistPath });

  it("answers an unknown API path with a bare not-found body", async () => {
    const response = await webApp().handle(get("http://localhost/api/missing"));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not Found" });
  });

  it("answers a missing asset with a plain-text 404", async () => {
    const response = await webApp().handle(
      get("http://localhost/assets/missing-456.js")
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not Found");
  });

  it("never serves a file from outside the assets directory", async () => {
    const app = webApp();
    const responses = await Promise.all(
      [
        "http://localhost/assets/%2e%2e/secret.txt",
        "http://localhost/assets/..%2Fsecret.txt",
        "http://localhost/secret.txt",
      ].map((url) => app.handle(get(url)))
    );
    const bodies = await Promise.all(
      responses.map((response) => response.text())
    );

    for (const body of bodies) expect(body).not.toContain("outside the assets");
  });

  it("answers a request that is not a GET outside the API with a not-found code", async () => {
    const response = await webApp().handle(
      new Request("http://localhost/evaluations/evaluation-1", {
        method: "POST",
      })
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      code: "not-found",
      error: "Not Found",
    });
  });
});
