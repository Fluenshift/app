import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ServerConfig } from "@fluenshift/env";
import { ConfigProvider, Effect, Layer } from "effect";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "./app";

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

const localApp = (options: WebOptions) =>
  createApp({ limits: local.limits, profile: local.profile, ...options });

const hostedApp = (options: WebOptions) =>
  createApp({ limits: hosted.limits, profile: hosted.profile, ...options });

const appWith = () => localApp({ serveWeb: false, webDistPath });

const webApp = () => localApp({ serveWeb: true, webDistPath });

const get = (url: string, headers: Record<string, string> = {}) =>
  new Request(url, { headers });

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
