// Ported from Grifando src/proxy.test.ts (74dbb9f) under docs/adr/0003 and docs/adr/0032, as
// contract tests of the hosted profile through `app.request`: the session gate and the CSP run
// as Hono middleware before every route instead of a Next.js proxy before each render, so
// nothing is forwarded to a render, a new cookie comes with the answer that serves the
// application shell, and the CSP is one static policy with no nonce. With the ports of the
// characterizations of the cookie Grifando minted and of the headers of its next.config.ts.
// With robots.txt and sitemap.xml, which Next.js generated from src/app/robots.ts and
// src/app/sitemap.ts and which the hosted profile answers itself, outside the session as
// Grifando's proxy matcher left them (docs/adr/0037).
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ServerConfig, SessionConfig } from "@grifando/env";
import {
  ConfigProvider,
  Effect,
  Layer,
  ManagedRuntime,
  Redacted,
} from "effect";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createApp } from "../app";
import { LearnerIdentity } from "../learner-identity";
import { CONTENT_SECURITY_POLICY } from "./hosted-pipeline";
import {
  SESSION_COOKIE,
  signSessionId,
  verifySessionToken,
} from "./session-token";

let webDistPath = "";

beforeAll(async () => {
  webDistPath = await mkdtemp(path.join(tmpdir(), "grifando-web-"));
  await mkdir(path.join(webDistPath, "assets"));
  await writeFile(
    path.join(webDistPath, "index.html"),
    "<main>Grifando</main>"
  );
  await writeFile(path.join(webDistPath, "assets", "app-123.js"), "export {};");
});

afterAll(async () => {
  await rm(webDistPath, { force: true, recursive: true });
});

afterEach(() => {
  vi.useRealTimers();
});

const fromEnv = (env: Record<string, string>) =>
  ConfigProvider.layer(ConfigProvider.fromEnvRecord(env));

const SECRET = { SESSION_SECRET: "pipeline-test-secret-xxxxxxxxxxxxxxxxxxxx" };
const SITE_URL = "https://grifando.example";

// The session settings the hosted profile reads under one NODE_ENV.
const sessionFor = (nodeEnv: string) =>
  Effect.runSync(
    Effect.provide(
      SessionConfig,
      SessionConfig.layer.pipe(
        Layer.provide(fromEnv({ ...SECRET, NODE_ENV: nodeEnv }))
      )
    )
  );

const session = sessionFor("test");

const getSessionSecret = () => Redacted.value(session.secret);

const { limits } = Effect.runSync(
  Effect.provide(
    ServerConfig,
    ServerConfig.layer.pipe(
      Layer.provide(
        fromEnv({
          DATABASE_URL: "postgres://app@db:5432/app",
          DEPLOY_PROFILE: "hosted",
        })
      )
    )
  )
);

const runtime = ManagedRuntime.make(
  LearnerIdentity.hosted.pipe(
    Layer.provide(Layer.succeed(SessionConfig, SessionConfig.of(session)))
  )
);

const hostedApp = (settings = session) =>
  createApp({
    limits,
    profile: "hosted",
    runtime,
    serveWeb: true,
    session: settings,
    siteUrl: SITE_URL,
    webDistPath,
  });

const request = (cookie?: string) =>
  new Request("http://127.0.0.1:3000/", {
    headers: cookie === undefined ? {} : { cookie },
  });

const validCookie = () =>
  `${SESSION_COOKIE}=${signSessionId("user-1", getSessionSecret())}`;

// The value of the session cookie an answer sets.
const mintedToken = (setCookie: string) => {
  const value = new RegExp(`${SESSION_COOKIE}=([^;]+)`, "u").exec(
    setCookie
  )?.[1];
  if (value === undefined) {
    throw new Error(`No ${SESSION_COOKIE} in "${setCookie}"`);
  }
  return decodeURIComponent(value);
};

// Everything after the cookie's value, which is a fresh signed id each time.
const attributesOf = (response: Response) => {
  const cookie = response.headers.get("set-cookie") ?? "";
  return cookie.slice(cookie.indexOf(";"));
};

describe("hosted request pipeline", () => {
  it("answers 401 SESSION_REQUIRED to an /api request without a valid cookie and mints nothing", async () => {
    const response = await hostedApp().request(
      new Request("http://127.0.0.1:3000/api/evaluations", { method: "POST" })
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toEqual({
      code: "SESSION_REQUIRED",
      error: "Session expired. Reload the page.",
    });
  });

  it("lets an /api request with a valid cookie through", async () => {
    const response = await hostedApp().request(
      new Request("http://127.0.0.1:3000/api/deploy-profile", {
        headers: { cookie: validCookie() },
      })
    );
    expect(response.status).toBe(200);
  });

  it("mints a cookie when none is present, on the answer that serves the application shell", async () => {
    const response = await hostedApp().request(request());
    const set = response.headers.get("set-cookie") ?? "";
    expect(set).toMatch(new RegExp(`^${SESSION_COOKIE}=`, "u"));
    expect(set.toLowerCase()).toContain("httponly");
    expect(set.toLowerCase()).toContain("samesite=lax");
    expect(
      verifySessionToken(mintedToken(set), getSessionSecret())
    ).not.toBeNull();
    expect(await response.text()).toBe("<main>Grifando</main>");
  });

  it("leaves a valid cookie untouched", async () => {
    const response = await hostedApp().request(request(validCookie()));
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("sets the static CSP on every response, with or without a session", async () => {
    const responses = await Promise.all(
      [
        request(),
        request(validCookie()),
        new Request("http://127.0.0.1:3000/api/evaluations", {
          method: "POST",
        }),
        new Request("http://127.0.0.1:3000/api/deploy-profile", {
          headers: { cookie: validCookie() },
        }),
        new Request("http://127.0.0.1:3000/assets/app-123.js"),
      ].map((each) => hostedApp().request(each))
    );
    for (const response of responses) {
      expect(response.headers.get("content-security-policy")).toBe(
        CONTENT_SECURITY_POLICY
      );
    }
  });

  it("builds the exact policy of the static single-page application", async () => {
    const response = await hostedApp().request(request());
    expect(response.headers.get("content-security-policy")).toBe(
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://i.ytimg.com; font-src 'self'; connect-src 'self'; frame-src https://open.spotify.com https://www.youtube-nocookie.com https://www.youtube.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests"
    );
  });

  it("replaces tampered and wrong-secret cookies, keeping other cookies", async () => {
    await Promise.all(
      [
        signSessionId("user-1", getSessionSecret()).replace("user-1", "user-2"),
        signSessionId("user-1", "some-other-secret-xxxxxxxxxxxxxxxx"),
      ].map(async (bad) => {
        const response = await hostedApp().request(
          request(`theme=x; ${SESSION_COOKIE}=${bad}`)
        );
        const set = response.headers.get("set-cookie") ?? "";
        expect(set).toMatch(new RegExp(`^${SESSION_COOKIE}=`, "u"));
        expect(set).not.toContain(bad);
        expect(set).not.toContain("theme");
      })
    );
  });

  it("answers the health check without a session, and mints nothing", async () => {
    const response = await hostedApp().request(
      new Request("http://127.0.0.1:3000/api/health")
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("mints no cookie on the build's static assets", async () => {
    const response = await hostedApp().request(
      new Request("http://127.0.0.1:3000/assets/app-123.js")
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

// The security headers of an answer, in the order and shape next.config.ts listed them.
const securityHeadersOf = (response: Response) =>
  [
    "X-Content-Type-Options",
    "Referrer-Policy",
    "Permissions-Policy",
    "Strict-Transport-Security",
  ].map((key) => ({ key, value: response.headers.get(key) }));

describe("next.config security headers", () => {
  it("adds nosniff, the referrer policy, the permissions policy and HSTS to every path, without X-Powered-By", async () => {
    const responses = await Promise.all(
      [
        request(),
        new Request("http://127.0.0.1:3000/api/evaluations", {
          method: "POST",
        }),
        new Request("http://127.0.0.1:3000/api/health"),
        new Request("http://127.0.0.1:3000/assets/app-123.js"),
      ].map((each) => hostedApp().request(each))
    );
    for (const response of responses) {
      expect(response.headers.has("X-Powered-By")).toBe(false);
      expect(securityHeadersOf(response)).toEqual([
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ]);
    }
  });
});

describe("proxy session cookie", () => {
  it("mints the session cookie site-wide for a year, Secure in production only", async () => {
    vi.useFakeTimers({
      now: new Date("2026-11-20T12:00:00.000Z"),
      toFake: ["Date"],
    });
    const development = attributesOf(
      await hostedApp(sessionFor("development")).request(request())
    );
    const production = attributesOf(
      await hostedApp(sessionFor("production")).request(request())
    );

    expect(development).toBe(
      "; Path=/; Expires=Sat, 20 Nov 2027 12:00:00 GMT; Max-Age=31536000; HttpOnly; SameSite=lax"
    );
    expect(production).toBe(
      "; Path=/; Expires=Sat, 20 Nov 2027 12:00:00 GMT; Max-Age=31536000; Secure; HttpOnly; SameSite=lax"
    );
  });
});

const answerAt = (pathname: string) =>
  hostedApp().request(new Request(`http://127.0.0.1:3000${pathname}`));

describe("proxy matcher", () => {
  it("leaves robots.txt and sitemap.xml out of the session, which every page gets", async () => {
    const paths = [
      "/",
      "/privacy",
      "/settings",
      "/technical",
      "/robots.txt",
      "/sitemap.xml",
    ];
    const answers = await Promise.all(paths.map(answerAt));

    expect(
      answers.map((answer, index) => [
        paths[index],
        answer.headers.get("set-cookie") !== null,
      ])
    ).toEqual([
      ["/", true],
      ["/privacy", true],
      ["/settings", true],
      ["/technical", true],
      ["/robots.txt", false],
      ["/sitemap.xml", false],
    ]);
  });
});

describe("robots", () => {
  it("allows every crawler everywhere but /api/ and names the sitemap at the public origin", async () => {
    const response = await answerAt("/robots.txt");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=UTF-8"
    );
    expect(await response.text()).toBe(
      "User-Agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: https://grifando.example/sitemap.xml\n"
    );
  });
});

describe("sitemap", () => {
  it("lists the four public routes and nothing under /api", async () => {
    const response = await answerAt("/sitemap.xml");
    const sitemap = await response.text();
    const urls = Array.from(
      sitemap.matchAll(/<loc>(?<url>[^<]*)<\/loc>/gu),
      (match) => match.groups?.url
    );
    const base = SITE_URL;

    expect(response.headers.get("content-type")).toBe("application/xml");
    expect(urls).toEqual([
      `${base}/`,
      `${base}/technical`,
      `${base}/privacy`,
      `${base}/settings`,
    ]);
    expect(urls.some((url) => url?.includes("/api"))).toBe(false);
  });
});
