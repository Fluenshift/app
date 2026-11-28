import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { SetupStatus } from "@grifando/contract";
import { ServerConfig } from "@grifando/env";
import {
  ConfigProvider,
  Effect,
  Layer,
  ManagedRuntime,
  Option,
  Redacted,
} from "effect";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type {
  KeyTestStatus,
  TrainerCredentials,
} from "./academy/trainer/trainer-client";
import { createApp, serveApp } from "./app";
import type { AppBoundaries } from "./app";
import type { EvaluationEndpointResult } from "./evaluation/evaluation-endpoint";
import { JudgeKey } from "./evaluation/evaluation-model";
import { LearnerIdentity } from "./learner-identity";
import { SESSION_COOKIE, signSessionId } from "./session/session-token";
import { setupStatusOf } from "./setup-status";

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

// The boundaries of these tests need nothing but the Learner of the request.
const runtime = ManagedRuntime.make(LearnerIdentity.local);

const localApp = (options: WebOptions & AppBoundaries) =>
  createApp({
    limits: local.limits,
    profile: "local",
    runtime,
    ...options,
  });

// The hosted profile's session, signed with a secret of these tests (docs/adr/0032).
const hostedSession = {
  secret: Redacted.make("app-test-secret-xxxxxxxxxxxxxxxxxxxxxxxx"),
  secureCookie: false,
};

// The cookie of a hosted Learner's session, which every API route but the health check needs.
const hostedSessionCookie = {
  cookie: `${SESSION_COOKIE}=${signSessionId("visitor-1", Redacted.value(hostedSession.secret))}`,
};

const hostedApp = (options: WebOptions & AppBoundaries) =>
  createApp({
    limits: hosted.limits,
    profile: "hosted",
    runtime,
    session: hostedSession,
    siteUrl: "https://grifando.example",
    ...options,
  });

const appWith = (boundaries: AppBoundaries = {}) =>
  localApp({ serveWeb: false, webDistPath, ...boundaries });

const webApp = () => localApp({ serveWeb: true, webDistPath });

const get = (url: string, headers: Record<string, string> = {}) =>
  new Request(url, { headers });

// A POST whose body arrives as a stream of `bytes` spaces, so it declares no length, as a
// chunked request does (#272).
const streamedPost = (url: string, bytes: number) => {
  const chunk = new Uint8Array(16 * 1024).fill(0x20);
  let sent = 0;
  return new Request(url, {
    body: new ReadableStream<Uint8Array>({
      pull: (controller) => {
        const size = Math.min(chunk.length, bytes - sent);
        if (size <= 0) {
          controller.close();
          return;
        }
        controller.enqueue(chunk.slice(0, size));
        sent += size;
      },
    }),
    duplex: "half",
    headers: { "content-type": "application/json" },
    method: "POST",
  });
};

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

const summary = ({ period }: { readonly period: string }) =>
  Effect.succeed({ evaluationCount: 0, period });

// Echoes the decoded request, so a test sees what reached the boundary.
const evidence = ({
  period,
  selection,
}: {
  readonly period: string;
  readonly selection: unknown;
}) => Effect.succeed({ period, selection });

const postEvidence = (body: unknown) =>
  new Request("http://localhost/api/progress/evidence", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

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
      get("https://grifando.example/api/health", {
        origin: "https://grifando.example",
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

  // HR-02 caps the body at the edge, whether or not the request declares its length (#272).
  it("lets a streamed body at the cap through and refuses one past it, though neither declares its length", async () => {
    const app = appWith();
    const atCap = await app.request(
      streamedPost("http://localhost/api/unknown", local.limits.bodyMaxBytes)
    );
    const pastCap = await app.request(
      streamedPost(
        "http://localhost/api/unknown",
        local.limits.bodyMaxBytes + 1
      )
    );

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

  it("rejects a streamed body over the cap before evaluation in the hosted profile", async () => {
    const app = hostedApp({ serveWeb: false, webDistPath });
    const response = await app.request(
      streamedPost(
        "http://localhost/api/evaluations",
        hosted.limits.bodyMaxBytes + 1
      )
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toStrictEqual({
      code: "sample-too-large",
      error: "Writing Sample is too large",
    });
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

  it("serves retained History, Progress, deletion, and setup through same-origin API", async () => {
    const deleted: string[] = [];
    const app = localApp({
      deleteEvaluation: (id) =>
        Effect.sync(() => {
          deleted.push(id);
        }),
      getEvaluation: (id) =>
        Effect.succeed(id === "kept" ? { id: "kept" } : null),
      getProgressEvidence: ({ period, selection }) =>
        Effect.succeed({
          evaluations: [],
          findings: [],
          period,
          rubricVersion: "1",
          selection,
        }),
      getProgressSummary: ({ period }) =>
        Effect.succeed({
          evaluationCount: 0,
          incompatibleSegments: [],
          period,
          rubricVersion: "1",
        }),
      listEvaluations: () => Effect.succeed([{ id: "kept" }]),
      serveWeb: false,
      setup: {
        configured: false,
        dataLocation: "/data/local.db",
        model: "openai/gpt-5.6-terra",
        provider: "OpenRouter",
        rubricVersion: "1",
      },
      webDistPath,
    });

    const historyResponse = await app.request(
      new Request("http://localhost/api/evaluations")
    );
    expect(historyResponse.headers.get("cache-control")).toBe("no-store");
    expect(await historyResponse.json()).toEqual([{ id: "kept" }]);
    const detailResponse = await app.request(
      new Request("http://localhost/api/evaluations/kept")
    );
    expect(await detailResponse.json()).toEqual({ id: "kept" });
    const missingResponse = await app.request(
      new Request("http://localhost/api/evaluations/missing")
    );
    expect(missingResponse.status).toBe(404);
    const deletionResponse = await app.request(
      new Request("http://localhost/api/evaluations/delete", {
        method: "DELETE",
      })
    );
    expect(deletionResponse.status).toBe(204);
    expect(deleted).toEqual(["delete"]);
    const progressResponse = await app.request(
      new Request("http://localhost/api/progress?period=7-days")
    );
    expect(await progressResponse.json()).toMatchObject({ period: "7-days" });
    // ADR 0008: the selection travels in the body, out of the URL.
    const evidenceResponse = await app.request(
      new Request("http://localhost/api/progress/evidence", {
        body: JSON.stringify({
          period: "all",
          selection: { kind: "average-score" },
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
    );
    expect(await evidenceResponse.json()).toMatchObject({
      selection: { kind: "average-score" },
    });
    const setupResponse = await app.request(
      new Request("http://localhost/api/setup")
    );
    expect(await setupResponse.json()).toMatchObject({
      configured: false,
      provider: "OpenRouter",
    });
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

  // Vocabulary left the product with its routes (ADR 0046).
  it("answers the vocabulary routes with a not-found code", async () => {
    const app = appWith();
    const responses = await Promise.all([
      app.request(get("http://localhost/api/vocabulary")),
      app.request(
        new Request("http://localhost/api/vocabulary", {
          body: JSON.stringify({ meaningPt: "depender de", term: "rely on" }),
          headers: { "content-type": "application/json" },
          method: "POST",
        })
      ),
      app.request(
        new Request("http://localhost/api/vocabulary/item-1", {
          method: "DELETE",
        })
      ),
    ]);

    expect(responses.map((response) => response.status)).toStrictEqual([
      404, 404, 404,
    ]);
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

describe("Progress endpoints", () => {
  it("answers 503 not-ready when Progress is unavailable", async () => {
    const app = appWith();
    const responses = await Promise.all([
      app.request(get("http://localhost/api/progress?period=all")),
      app.request(
        get(
          "http://localhost/api/progress/evidence?period=all&insight=finding-rate"
        )
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
        error: "Progress is not available",
      });
    }
  });

  it("accepts exactly the 7-days, 30-days and all periods", async () => {
    const app = appWith({ getProgressSummary: summary });
    const accepted = await Promise.all(
      ["7-days", "30-days", "all"].map(async (period) => {
        const response = await app.request(
          get(`http://localhost/api/progress?period=${period}`)
        );
        return response.json();
      })
    );
    const refused = await Promise.all(
      [
        "http://localhost/api/progress",
        "http://localhost/api/progress?period=90-days",
        "http://localhost/api/progress?period=All",
      ].map((url) => app.request(get(url)))
    );
    const refusals = await Promise.all(
      refused.map((response) => response.json())
    );

    expect(accepted).toEqual([
      { evaluationCount: 0, period: "7-days" },
      { evaluationCount: 0, period: "30-days" },
      { evaluationCount: 0, period: "all" },
    ]);
    for (const response of refused) {
      expect(response.status).toBe(400);
    }
    for (const body of refusals) {
      expect(body).toEqual({
        code: "invalid-period",
        error: "Progress period is invalid",
      });
    }
  });

  // Ported from PE's app.characterization.test.ts, where every selection travelled in the
  // query string. ADR 0008 moves the Correction, text the Learner wrote, into the body of
  // POST /api/progress/evidence; every other selection, status and body stays as it was. #65
  // built both routes before these tests existed, so their rows are superseded under ADR 0021.
  it("selects evidence by insight, Error Category or correction", async () => {
    const app = appWith({ getProgressEvidence: evidence });
    const responses = await Promise.all([
      app.request(
        get(
          "http://localhost/api/progress/evidence?period=7-days&insight=finding-rate"
        )
      ),
      app.request(
        get(
          "http://localhost/api/progress/evidence?period=30-days&insight=average-score"
        )
      ),
      app.request(
        get(
          "http://localhost/api/progress/evidence?period=all&insight=category&category=Verb%20form%2Ftense"
        )
      ),
      app.request(
        postEvidence({
          period: "all",
          selection: {
            correction: "an apple",
            kind: "correction",
            originalText: "a apple",
          },
        })
      ),
    ]);
    const selections = await Promise.all(
      responses.map((response) => response.json())
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
    const responses = await Promise.all([
      app.request(
        get(
          "http://localhost/api/progress/evidence?period=all&insight=improvement"
        )
      ),
      app.request(
        get(
          "http://localhost/api/progress/evidence?period=all&insight=category&category=Style"
        )
      ),
      app.request(
        postEvidence({
          period: "all",
          selection: { kind: "correction", originalText: "a apple" },
        })
      ),
      app.request(
        get(
          "http://localhost/api/progress/evidence?period=year&insight=finding-rate"
        )
      ),
      app.request(get("http://localhost/api/progress/evidence?period=all")),
    ]);
    const bodies = await Promise.all(
      responses.map((response) => response.json())
    );

    for (const response of responses) {
      expect(response.status).toBe(400);
    }
    for (const body of bodies) {
      expect(body).toEqual({
        code: "invalid-selection",
        error: "Progress selection is invalid",
      });
    }
  });
});

// Ported from Grifando src/app/api/ai-key/test/route.test.ts (74dbb9f) as contract tests: the
// route reads the key from the request headers only, and TrainerClient.testKey, faked here,
// classifies the provider's answer (#98). The rate limiter's 429 waits for the hosted profile,
// and the provider that never answers is #98's deadline (ADR 0021).
const keyTester = (status: KeyTestStatus) =>
  vi.fn((_credentials: TrainerCredentials) => Effect.succeed(status));

const GEMINI_KEY = { "x-ai-key": "test-key", "x-ai-provider": "gemini" };

const postKeyTest = (headers: Record<string, string> = GEMINI_KEY) =>
  new Request("http://localhost/api/ai-key/test", { headers, method: "POST" });

describe("POST /api/ai-key/test", () => {
  it("answers works when the provider accepts the key", async () => {
    const testTrainerKey = keyTester("works");
    const res = await appWith({ testTrainerKey }).request(postKeyTest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "works" });
    expect(testTrainerKey).toHaveBeenCalledTimes(1);
    expect(testTrainerKey.mock.calls[0]?.[0].provider).toBe("gemini");
  });

  it("uses the Anthropic helper for an Anthropic key", async () => {
    const testTrainerKey = keyTester("works");
    const res = await appWith({ testTrainerKey }).request(
      postKeyTest({ "x-ai-key": "test-key", "x-ai-provider": "anthropic" })
    );
    expect(await res.json()).toEqual({ status: "works" });
    expect(testTrainerKey).toHaveBeenCalledTimes(1);
    expect(testTrainerKey.mock.calls[0]?.[0].provider).toBe("anthropic");
  });

  it("answers invalid when the provider rejects the key", async () => {
    const testTrainerKey = keyTester("invalid");
    const res = await appWith({ testTrainerKey }).request(postKeyTest());
    expect(await res.json()).toEqual({ status: "invalid" });
  });

  it("answers invalid for a malformed key without calling the provider", async () => {
    const testTrainerKey = keyTester("works");
    const res = await appWith({ testTrainerKey }).request(
      postKeyTest({ "x-ai-key": "test-key", "x-ai-provider": "openai" })
    );
    expect(await res.json()).toEqual({ status: "invalid" });
    expect(testTrainerKey).not.toHaveBeenCalled();
  });

  it("answers busy when the provider is unavailable or out of quota", async () => {
    const app = appWith({ testTrainerKey: keyTester("busy") });
    const unavailable = await app.request(postKeyTest());
    expect(await unavailable.json()).toEqual({ status: "busy" });
    const outOfQuota = await app.request(postKeyTest());
    expect(await outOfQuota.json()).toEqual({ status: "busy" });
  });

  it("answers 401 AI_KEY_REQUIRED when no key headers are sent (env keys are never tested)", async () => {
    const testTrainerKey = keyTester("works");
    const res = await appWith({ testTrainerKey }).request(postKeyTest({}));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "AI_KEY_REQUIRED" });
    expect(testTrainerKey).not.toHaveBeenCalled();
  });
});

// The Deploy Profile's caps on one Writing Sample, which size the Academy's writing sheets
// (docs/adr/0006, #196).
describe("Sample limits endpoint", () => {
  it("answers the local profile's 32 KiB and no character cap", async () => {
    const response = await appWith().request(
      get("http://localhost/api/sample-limits")
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({
      codeMaxCharacters: null,
      sampleMaxBytes: 32_768,
      sampleMaxCharacters: null,
    });
  });

  it("answers the hosted profile's 5000 characters within the same 32 KiB", async () => {
    const response = await hostedApp({ serveWeb: false, webDistPath }).request(
      get("https://grifando.example/api/sample-limits", hostedSessionCookie)
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({
      codeMaxCharacters: 2000,
      sampleMaxBytes: 32_768,
      sampleMaxCharacters: 5000,
    });
  });
});

// The Deploy Profile the SPA reads at startup, to know whether it sends the browser's AI key
// (docs/adr/0034).
describe("Deploy profile endpoint", () => {
  it("names the local profile", async () => {
    const response = await appWith().request(
      get("http://localhost/api/deploy-profile")
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({ deployProfile: "local" });
  });

  it("names the hosted profile to a Learner with a session", async () => {
    const response = await hostedApp({ serveWeb: false, webDistPath }).request(
      get("https://grifando.example/api/deploy-profile", hostedSessionCookie)
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({ deployProfile: "hosted" });
  });
});

// The local profile's Judge runs on its configured key, never on one a request carries
// (docs/adr/0035).
describe("Judge key in the local profile", () => {
  it("never reads the Judge's key from the request", async () => {
    const keys: (string | null)[] = [];
    const evaluateWriting = () =>
      Effect.serviceOption(JudgeKey).pipe(
        Effect.flatMap((key) =>
          Effect.sync(() => {
            keys.push(
              Option.isSome(key) ? Redacted.value(key.value.apiKey) : null
            );
          })
        ),
        Effect.andThen(Effect.die(new Error("judged")))
      );

    await appWith({ evaluateWriting }).request(
      postSample(JSON.stringify({ writingSample: "A sample." }), {
        "x-ai-key": "sk-or-test",
        "x-ai-provider": "openrouter",
      })
    );

    expect(keys).toStrictEqual([null]);
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

  // The Trainer's models of these tests, one pair per provider.
  const trainerModels = {
    anthropic: { fallback: "claude-haiku", primary: "claude-sonnet-5" },
    gemini: { fallback: "gemini-lite", primary: "gemini-3.5-flash" },
    openrouter: { fallback: "or-lite", primary: "or-flash" },
  };
  const judge = {
    configured: true,
    model: "openai/gpt-5.6-terra",
    provider: "OpenRouter",
  };

  it("answers the Trainer the local profile holds a key for, beside the Judge", async () => {
    const response = await appWith({
      setup: setupStatusOf({
        dataLocation: "/data/pglite",
        judge,
        profile: "local",
        trainer: {
          localKey: Option.some({
            apiKey: Redacted.make("trainer-key"),
            provider: "gemini",
          }),
          models: trainerModels,
        },
      }),
    }).request(get("http://localhost/api/setup"));

    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({
      configured: true,
      dataLocation: "/data/pglite",
      model: "openai/gpt-5.6-terra",
      provider: "OpenRouter",
      rubricVersion: "1-provisional",
      trainer: {
        configured: true,
        model: "gemini-3.5-flash",
        provider: "Gemini",
      },
    });
  });

  it("answers that the local profile holds no Trainer key", async () => {
    const response = await appWith({
      setup: setupStatusOf({
        dataLocation: "/data/pglite",
        judge,
        profile: "local",
        trainer: { localKey: Option.none(), models: trainerModels },
      }),
    }).request(get("http://localhost/api/setup"));

    expect(await response.json()).toStrictEqual({
      configured: true,
      dataLocation: "/data/pglite",
      model: "openai/gpt-5.6-terra",
      provider: "OpenRouter",
      rubricVersion: "1-provisional",
      trainer: { configured: false },
    });
  });

  it("answers no Trainer in the hosted profile, whose visitors bring their own key", async () => {
    const response = await hostedApp({
      serveWeb: false,
      setup: setupStatusOf({
        dataLocation: "PostgreSQL",
        judge: { ...judge, configured: false },
        profile: "hosted",
        trainer: {
          localKey: Option.some({
            apiKey: Redacted.make("trainer-key"),
            provider: "anthropic",
          }),
          models: trainerModels,
        },
      }),
      webDistPath,
    }).request(get("http://localhost/api/setup", hostedSessionCookie));

    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({
      configured: false,
      dataLocation: "PostgreSQL",
      model: "openai/gpt-5.6-terra",
      provider: "OpenRouter",
      rubricVersion: "1-provisional",
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
