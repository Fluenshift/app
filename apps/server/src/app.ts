import { readFile } from "node:fs/promises";
import path from "node:path";

import type { HealthResponse } from "@fluenshift/contract";
import type { DeployProfile, InputLimits } from "@fluenshift/env";
import { Hono } from "hono";
import type { Handler, MiddlewareHandler } from "hono";
import { getMimeType } from "hono/utils/mime";

import { INTERNAL_ERROR } from "./edge";
import type { EdgeFailure } from "./edge";

export interface AppOptions {
  /** The input caps of the deploy profile (docs/adr/0006). */
  readonly limits: InputLimits;
  readonly profile: DeployProfile;
  /** Whether this process also serves the web build, as it does in production. */
  readonly serveWeb: boolean;
  readonly webDistPath: string;
}

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

const FORBIDDEN: EdgeFailure = {
  body: {
    code: "forbidden",
    error: "Only same-origin localhost access is allowed",
  },
  status: 403,
};

const SAMPLE_TOO_LARGE: EdgeFailure = {
  body: { code: "sample-too-large", error: "Writing Sample is too large" },
  status: 413,
};

/**
 * The local profile has no authentication, so it answers only same-origin requests to a
 * loopback host name: binding to loopback alone does not stop a hostile web page from driving
 * the application (docs/adr/0003).
 */
const isForeign = (request: Request): boolean => {
  const url = new URL(request.url);
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");
  return (
    !LOOPBACK_HOSTNAMES.has(url.hostname) ||
    (host !== null && host !== url.host) ||
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (origin !== null && origin !== url.origin)
  );
};

const refusalOf = (
  request: Request,
  { limits, profile }: AppOptions
): EdgeFailure | undefined => {
  if (profile === "local" && isForeign(request)) {
    return FORBIDDEN;
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  return contentLength > limits.bodyMaxBytes ? SAMPLE_TOO_LARGE : undefined;
};

/**
 * Runs before every route: it refuses a foreign request and a declared body over the cap, and
 * marks every API answer as not storable. An accepted request gets the header once its answer
 * exists, because a route may answer with a `Response` of its own, as the edge helper does.
 */
const guard =
  (options: AppOptions): MiddlewareHandler =>
  (context, next) => {
    const markApi = () => {
      if (context.req.path.startsWith("/api/")) {
        context.header("cache-control", "no-store");
      }
    };
    const refusal = refusalOf(context.req.raw, options);
    if (refusal !== undefined) {
      markApi();
      return Promise.resolve(context.json(refusal.body, refusal.status));
    }
    return next().then(markApi);
  };

/**
 * Answers every GET that no API route took. Only files under `assets/` of the web build are
 * served, and the path is never decoded, so no request reaches a file outside that directory.
 * Any other path is a browser route and gets the application shell.
 */
const webFallback = (webDistPath: string): Handler => {
  const root = path.resolve(webDistPath);
  const index = path.resolve(root, "index.html");

  return (context) => {
    if (context.req.path.startsWith("/api/")) {
      return context.json({ error: "Not Found" }, 404);
    }

    const requestPath = new URL(context.req.url).pathname;
    if (!requestPath.startsWith("/assets/")) {
      return readFile(index, "utf-8").then((html) =>
        context.html(html, 200, { "cache-control": "no-cache" })
      );
    }

    const assetPath = path.resolve(root, `.${requestPath}`);
    if (!assetPath.startsWith(`${root}${path.sep}`)) {
      return context.text("Not Found", 404);
    }
    return readFile(assetPath).then(
      (asset) =>
        context.body(asset, 200, {
          "cache-control": "public, max-age=31536000, immutable",
          "content-type": getMimeType(assetPath) ?? "application/octet-stream",
        }),
      () => context.text("Not Found", 404)
    );
  };
};

/**
 * The HTTP application: the API and, in production, the web build, from one process. Routes
 * answer from Effects through the edge helper (`./edge`).
 */
export const createApp = (options: AppOptions) => {
  const app = new Hono()
    .use(guard(options))
    .get("/api/health", (context) =>
      context.json({ status: "ok" } satisfies HealthResponse)
    )
    .notFound((context) =>
      context.json({ code: "not-found", error: "Not Found" }, 404)
    )
    .onError((_error, context) =>
      context.json(INTERNAL_ERROR.body, INTERNAL_ERROR.status)
    );

  if (options.serveWeb) {
    app.get("/*", webFallback(options.webDistPath));
  }
  return app;
};

export type AppType = ReturnType<typeof createApp>;
