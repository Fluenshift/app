import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { SetupStatus } from "@fluenshift/contract";
import { ServerConfig } from "@fluenshift/env";
import { ConfigProvider, Effect, Layer } from "effect";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp, serveApp } from "./app";
import type { AppBoundaries } from "./app";
import type { EvaluationEndpointResult } from "./evaluation/evaluation-endpoint";

let webDistPath = "";
let emptyWebDistPath = "";

beforeAll(async () => {
  webDistPath = await mkdtemp(path.join(tmpdir(), "prompt-evolution-web-"));
  emptyWebDistPath = await mkdtemp(
    path.join(tmpdir(), "prompt-evolution-web-")
  );
  await mkdir(path.join(webDistPath, "assets"));
  await writeFile(
    path.join(webDistPath, "index.html"),
    "<main>Prompt Evolution</main>"
  );
  await writeFile(path.join(webDistPath, "assets", "app-123.js"), "export {};");
  await writeFile(path.join(webDistPath, "assets", "font-789.face"), "font");
  await writeFile(path.join(webDistPath, "secret.txt"), "outside the assets");
});

afterAll(async () => {
  await rm(webDistPath, { force: true, recursive: true });
  await rm(emptyWebDistPath, { force: true, recursive: true });
});

// The profile and the caps of each deploy profile, as the server reads them at startup.
const configOf = (env: Record<string, string>) =>
  Effect.runSync(
    Effect.provide(
      ServerConfig,
      ServerConfig.layer.pipe(
        Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(env)))
      )
    )
  );

const local = configOf({ DATA_DIRECTORY: "/data/pglite" });
const hosted = configOf({
  DATABASE_URL: "postgres://app@db:5432/app",
  DEPLOY_PROFILE: "hosted",
});

interface WebOptions {
  readonly serveWeb: boolean;
  readonly webDistPath: string;
}

const localApp = (options: WebOptions & AppBoundaries) =>
  createApp({ limits: local.limits, profile: local.profile, ...options });

const hostedApp = (options: WebOptions) =>
  createApp({ limits: hosted.limits, profile: hosted.profile, ...options });

const appWith = (boundaries: AppBoundaries = {}) =>
  localApp({ serveWeb: false, webDistPath, ...boundaries });

const webApp = () => localApp({ serveWeb: true, webDistPath });

const get = (url: string, headers: Record<string, string> = {}) =>
  new Request(url, { headers });

const postSample = (body: string, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/evaluations", {
    body,
    headers: { "content-type": "application/json", ...headers },
    method: "POST",
  });

const sampleBody = JSON.stringify({ writingSample: "A short sample." });

const setup: SetupStatus = {
  configured: true,
  dataLocation: "/data/local.db",
  model: "openai/gpt-5.6-terra",
  provider: "OpenRouter",
  rubricVersion: "1",
};

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

describe("HTTP application", () => {
  it("answers the health check", async () => {
    const response = await appWith().request("/api/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toStrictEqual({ status: "ok" });
  });

  it("answers 404 for an unknown API route", async () => {
    const response = await appWith().request("/api/unknown");

    expect(response.status).toBe(404);
  });

  it("answers a host that is not loopback in the hosted profile", async () => {
    const app = hostedApp({ serveWeb: false, webDistPath });
    const response = await app.request(
      get("https://fluenshift.example/api/health", {
        origin: "https://fluenshift.example",
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({ status: "ok" });
  });

  it("answers a safe internal error when the web build has no index.html", async () => {
    const app = localApp({ serveWeb: true, webDistPath: emptyWebDistPath });
    const response = await app.request(get("http://localhost/"));
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(JSON.parse(text)).toStrictEqual({
      code: "internal-error",
      error: "Request could not be completed",
    });
    expect(text).not.toContain(emptyWebDistPath);
  });

  it("answers an asset with the content type of its extension", async () => {
    const app = localApp({ serveWeb: true, webDistPath });
    const script = await app.request(get("http://localhost/assets/app-123.js"));
    const unknown = await app.request(
      get("http://localhost/assets/font-789.face")
    );

    expect(script.headers.get("content-type")).toBe(
      "text/javascript; charset=utf-8"
    );
    expect(unknown.status).toBe(200);
    expect(unknown.headers.get("content-type")).toBe(
      "application/octet-stream"
    );
  });

  it("refuses a foreign Host header and a cross-site fetch in the local profile", async () => {
    const app = appWith();
    const responses = await Promise.all([
      app.request(
        get("http://localhost/api/health", { host: "attacker.example" })
      ),
      app.request(
        get("http://localhost/api/health", { "sec-fetch-site": "cross-site" })
      ),
    ]);
    const bodies = await Promise.all(
      responses.map((response) => response.json())
    );

    expect(responses.map((response) => response.status)).toStrictEqual([
      403, 403,
    ]);
    expect(
      responses.map((response) => response.headers.get("cache-control"))
    ).toStrictEqual(["no-store", "no-store"]);
    expect(bodies).toStrictEqual([
      {
        code: "forbidden",
        error: "Only same-origin localhost access is allowed",
      },
      {
        code: "forbidden",
        error: "Only same-origin localhost access is allowed",
      },
    ]);
  });

  it("refuses a foreign request for the web build without marking it as an API answer", async () => {
    const app = localApp({ serveWeb: true, webDistPath });
    const response = await app.request(get("http://attacker.example/"));

    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBeNull();
    expect(await response.text()).not.toContain("Prompt Evolution");
  });

  it("lets a declared body at the cap through and names the refusal past it", async () => {
    const app = appWith();
    const post = (contentLength: number) =>
      app.request(
        new Request("http://localhost/api/unknown", {
          body: "{}",
          headers: {
            "content-length": String(contentLength),
            "content-type": "application/json",
          },
          method: "POST",
        })
      );
    const atCap = await post(local.limits.bodyMaxBytes);
    const pastCap = await post(local.limits.bodyMaxBytes + 1);

    expect(local.limits.bodyMaxBytes).toBe(256 * 1024);
    expect(atCap.status).toBe(404);
    expect(pastCap.status).toBe(413);
    expect(pastCap.headers.get("cache-control")).toBe("no-store");
    expect(await pastCap.json()).toStrictEqual({
      code: "sample-too-large",
      error: "Writing Sample is too large",
    });
  });
});

describe("production HTTP application", () => {
  it("rejects declared oversized request bodies before evaluation in the local profile", async () => {
    const app = localApp({ serveWeb: false, webDistPath });
    const response = await app.request(
      new Request("http://localhost/api/evaluations", {
        body: JSON.stringify({ writingSample: "Private writing." }),
        headers: {
          "content-length": String(256 * 1024 + 1),
          "content-type": "application/json",
        },
        method: "POST",
      })
    );

    expect(response.status).toBe(413);
    expect(await response.text()).not.toContain("Private writing.");
  });

  it("rejects declared oversized request bodies before evaluation in the hosted profile", async () => {
    const app = hostedApp({ serveWeb: false, webDistPath });
    const response = await app.request(
      new Request("http://localhost/api/evaluations", {
        body: JSON.stringify({ writingSample: "Private writing." }),
        headers: {
          "content-length": String(256 * 1024 + 1),
          "content-type": "application/json",
        },
        method: "POST",
      })
    );

    expect(response.status).toBe(413);
    expect(await response.text()).not.toContain("Private writing.");
  });

  it("rejects remote hosts and cross-origin writes before evaluating", async () => {
    const app = localApp({ serveWeb: false, webDistPath });
    const remote = await app.request(
      new Request("http://attacker.example/api/health")
    );
    expect(remote.status).toBe(403);
    const crossOrigin = await app.request(
      new Request("http://localhost/api/evaluations", {
        body: JSON.stringify({ writingSample: "Private writing." }),
        headers: {
          "content-type": "application/json",
          origin: "https://attacker.example",
        },
        method: "POST",
      })
    );
    expect(crossOrigin.status).toBe(403);
    expect(await crossOrigin.text()).not.toContain("Private writing.");
  });

  it("keeps API routes ahead of browser fallback", async () => {
    const app = localApp({ serveWeb: true, webDistPath });
    const response = await app.request(
      new Request("http://localhost/api/health")
    );
    const missingResponse = await app.request(
      new Request("http://localhost/api/missing")
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(missingResponse.status).toBe(404);
    expect(missingResponse.headers.get("content-type")).toContain(
      "application/json"
    );
  });

  it("serves static assets with immutable caching", async () => {
    const app = localApp({ serveWeb: true, webDistPath });
    const response = await app.request(
      new Request("http://localhost/assets/app-123.js")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable"
    );
    expect(await response.text()).toBe("export {};");
  });

  it("falls back to uncached index.html for direct browser routes", async () => {
    const app = localApp({ serveWeb: true, webDistPath });
    const response = await app.request(
      new Request("http://localhost/evaluations/evaluation-1")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-cache");
    expect(await response.text()).toContain("Prompt Evolution");
  });

  it("keeps the real HTTP connection open beyond the provider request deadline", async () => {
    const server = serveApp(appWith(), { hostname: "127.0.0.1", port: 0 });
    const idle = server.timeout;
    server.close();
    await once(server, "close");

    expect(idle / 1000).toBe(120);
  });

  it("rejects malformed JSON without echoing private input", async () => {
    const app = appWith();
    const response = await app.request(
      new Request("http://localhost/api/evaluations", {
        body: JSON.stringify({
          writingSample: { private: "private-sample-sentinel" },
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
    );
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("private-sample-sentinel");
  });

  it("maps unexpected failures to a safe internal error", async () => {
    const app = appWith({
      listEvaluations: () => Effect.die(new Error("private-db-cause")),
    });
    const response = await app.request(
      new Request("http://localhost/api/evaluations")
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      code: "internal-error",
      error: "Request could not be completed",
    });
  });

  it("submits one exact Writing Sample through the Evaluation boundary", async () => {
    const samples: string[] = [];
    const app = appWith({
      evaluateWriting: (writingSample) =>
        Effect.sync(() => {
          samples.push(writingSample);
          return {
            evaluation: {
              band: "Natural" as const,
              correctedText: writingSample,
              evaluatedAt: "2026-09-07T12:00:00.000Z",
              evaluatedEnglishWordCount: 2,
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
            kind: "created" as const,
          };
        }),
    });
    const response = await app.request(
      new Request("http://localhost/api/evaluations", {
        body: JSON.stringify({ writingSample: "  Exact sample.\n" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
    );

    expect(response.status).toBe(201);
    expect(samples).toEqual(["  Exact sample.\n"]);
    expect(await response.json()).toMatchObject({
      evaluation: { id: "evaluation-1" },
      kind: "created",
    });
  });

  it("maps typed evaluation failures without exposing private causes", async () => {
    const results = [
      { expectedStatus: 422, result: { kind: "no-english" as const } },
      {
        expectedStatus: 504,
        result: {
          code: "provider-timeout" as const,
          kind: "failure" as const,
          retryable: true,
        },
      },
      {
        expectedStatus: 429,
        result: {
          code: "provider-rate-limited" as const,
          kind: "failure" as const,
          retryable: true,
        },
      },
      {
        expectedStatus: 503,
        result: {
          code: "provider-credits-exhausted" as const,
          kind: "failure" as const,
          retryable: false,
        },
      },
      {
        expectedStatus: 502,
        result: {
          code: "provider-output-incomplete" as const,
          kind: "failure" as const,
          retryable: true,
        },
      },
      {
        expectedStatus: 503,
        result: {
          code: "configuration-missing" as const,
          kind: "failure" as const,
          retryable: false,
        },
      },
      {
        expectedStatus: 400,
        result: {
          code: "invalid-writing-sample" as const,
          kind: "failure" as const,
          retryable: false,
        },
      },
      {
        expectedStatus: 502,
        result: {
          code: "invalid-assessment" as const,
          kind: "failure" as const,
          retryable: true,
        },
      },
      {
        expectedStatus: 500,
        result: {
          code: "persistence-failure" as const,
          kind: "failure" as const,
          retryable: true,
        },
      },
      {
        expectedStatus: 503,
        result: {
          code: "provider-unavailable" as const,
          kind: "failure" as const,
          retryable: true,
        },
      },
      {
        expectedStatus: 502,
        result: {
          code: "provider-rejected" as const,
          kind: "failure" as const,
          retryable: true,
        },
      },
    ];

    await Promise.all(
      results.map(async ({ expectedStatus, result }) => {
        const app = appWith({
          evaluateWriting: () => Effect.succeed(result),
        });
        const response = await app.request(
          new Request("http://localhost/api/evaluations", {
            body: JSON.stringify({ writingSample: "private-sample-sentinel" }),
            headers: { "content-type": "application/json" },
            method: "POST",
          })
        );

        expect(response.status).toBe(expectedStatus);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(await response.text()).not.toContain("private-sample-sentinel");
      })
    );
  });

  it("logs evaluation outcomes with correlation metadata but no Writing Sample", async () => {
    const events: unknown[] = [];
    const app = appWith({
      evaluateWriting: () => Effect.succeed({ kind: "no-english" }),
      logEvaluation: (event) => {
        events.push(event);
      },
    });
    const response = await app.request(
      new Request("http://localhost/api/evaluations", {
        body: JSON.stringify({ writingSample: "private-writing-sentinel" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
    );

    expect(response.headers.get("x-correlation-id")).toMatch(
      /^[0-9a-f-]{36}$/u
    );
    expect(events).toEqual([
      expect.objectContaining({
        code: "no-english",
        correlationId: response.headers.get("x-correlation-id"),
        maxOutputTokens: 6000,
        model: "unconfigured",
        provider: "unconfigured",
        requestTimeoutMilliseconds: 90_000,
      }),
    ]);
    expect(JSON.stringify(events)).not.toContain("private-writing-sentinel");
  });
});

describe("API errors", () => {
  it("answers an unknown API route with a not-found code", async () => {
    const response = await appWith().request(
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
      evaluateWriting: () => Effect.die(new Error("must not be called")),
    }).request(postSample("{"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: "invalid-request",
      error: "Request could not be completed",
    });
  });

  it("answers a body without a writingSample with an invalid-request code", async () => {
    const response = await appWith({
      evaluateWriting: () => Effect.die(new Error("must not be called")),
    }).request(postSample(JSON.stringify({ sample: "A short sample." })));

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
        async (origin) => {
          const response = await app.request(get(`${origin}/api/health`));
          return response.status;
        }
      )
    );

    expect(statuses).toEqual([200, 200, 200]);
  });

  it("allows a same-origin fetch that names its own Origin and Host", async () => {
    const response = await appWith().request(
      get("http://localhost:3000/api/health", {
        host: "localhost:3000",
        origin: "http://localhost:3000",
        "sec-fetch-site": "same-origin",
      })
    );

    expect(response.status).toBe(200);
  });

  it("forbids a remote host, a foreign Host header, a cross-site fetch and a foreign Origin alike", async () => {
    const evaluated: string[] = [];
    const app = appWith({
      evaluateWriting: (writingSample) =>
        Effect.sync(() => {
          evaluated.push(writingSample);
          return { kind: "no-english" as const };
        }),
    });
    const responses = await Promise.all([
      app.request(
        new Request("http://attacker.example/api/evaluations", {
          body: sampleBody,
          headers: { "content-type": "application/json" },
          method: "POST",
        })
      ),
      app.request(postSample(sampleBody, { host: "attacker.example" })),
      app.request(postSample(sampleBody, { "sec-fetch-site": "cross-site" })),
      app.request(postSample(sampleBody, { origin: "http://localhost:5173" })),
    ]);
    const bodies = await Promise.all(
      responses.map((response) => response.json())
    );

    for (const response of responses) {
      expect(response.status).toBe(403);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
    for (const body of bodies) {
      expect(body).toEqual({
        code: "forbidden",
        error: "Only same-origin localhost access is allowed",
      });
    }
    expect(evaluated).toEqual([]);
  });

  it("allows a declared body of exactly 256 KiB and refuses one byte more", async () => {
    const limit = 256 * 1024;
    const evaluated: number[] = [];
    const app = appWith({
      evaluateWriting: (writingSample) =>
        Effect.sync(() => {
          evaluated.push(writingSample.length);
          return { kind: "no-english" as const };
        }),
    });
    const atLimit = JSON.stringify({
      writingSample: "a".repeat(limit - '{"writingSample":""}'.length),
    });
    const accepted = await app.request(
      postSample(atLimit, { "content-length": String(limit) })
    );
    const refused = await app.request(
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

describe("browser fallback", () => {
  it("answers an unknown API path with a bare not-found body", async () => {
    const response = await webApp().request(
      get("http://localhost/api/missing")
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not Found" });
  });

  it("answers a missing asset with a plain-text 404", async () => {
    const response = await webApp().request(
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
      ].map((url) => app.request(get(url)))
    );
    const bodies = await Promise.all(
      responses.map((response) => response.text())
    );

    for (const body of bodies) {
      expect(body).not.toContain("outside the assets");
    }
  });

  it("answers a request that is not a GET outside the API with a not-found code", async () => {
    const response = await webApp().request(
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

describe("Evaluation endpoint", () => {
  it("answers 503 with a correlation ID when Evaluation is not configured", async () => {
    const response = await appWith().request(postSample(sampleBody));

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
        Effect.succeed(created(writingSample)),
    }).request(postSample(sampleBody));

    expect(response.status).toBe(201);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual(created("A short sample."));
  });

  it("returns no-english as its kind alone", async () => {
    const response = await appWith({
      evaluateWriting: () => Effect.succeed({ kind: "no-english" }),
    }).request(postSample(sampleBody));

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
            Effect.succeed({ code, kind: "failure", retryable }),
        }).request(postSample(sampleBody));
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
      evaluateWriting: () => Effect.die(new Error("private-cause")),
      logEvaluation: (event) => {
        events.push(event);
      },
    }).request(postSample(sampleBody));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      code: "internal-error",
      error: "Request could not be completed",
    });
    expect(events.map((event) => event.code)).toEqual(["internal-error"]);
  });

  it("keeps the outcome when logging throws", async () => {
    const response = await appWith({
      evaluateWriting: () => Effect.succeed({ kind: "no-english" }),
      logEvaluation: () => {
        throw new Error("logger down");
      },
    }).request(postSample(sampleBody));

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
        Effect.succeed(created(writingSample)),
      logEvaluation: (event) => {
        events.push(event);
      },
      setup,
    }).request(postSample(sampleBody));

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
      app.request(get("http://localhost/api/evaluations")),
      app.request(get("http://localhost/api/evaluations/evaluation-1")),
      app.request(
        new Request("http://localhost/api/evaluations/evaluation-1", {
          method: "DELETE",
        })
      ),
    ]);
    const bodies = await Promise.all(
      responses.map((response) => response.json())
    );

    for (const response of responses) {
      expect(response.status).toBe(503);
    }
    for (const body of bodies) {
      expect(body).toEqual({
        code: "not-ready",
        error: "History is not available",
      });
    }
  });

  it("answers a missing Evaluation with a not-found code", async () => {
    const response = await appWith({
      getEvaluation: () => Effect.succeed(null),
    }).request(get("http://localhost/api/evaluations/missing"));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      code: "not-found",
      error: "Evaluation not found",
    });
  });

  it("answers a deletion with an empty 204", async () => {
    const response = await appWith({
      deleteEvaluation: () => Effect.void,
    }).request(
      new Request("http://localhost/api/evaluations/evaluation-1", {
        method: "DELETE",
      })
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });
});

describe("Setup endpoint", () => {
  it("answers 503 not-ready without a setup status", async () => {
    const response = await appWith().request(get("http://localhost/api/setup"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      code: "not-ready",
      error: "Setup status is not available",
    });
  });

  it("returns the setup status whole", async () => {
    const response = await appWith({ setup }).request(
      get("http://localhost/api/setup")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual(setup);
  });
});
