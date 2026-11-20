// The hosted profile's request pipeline (docs/adr/0003, docs/adr/0032), ported from Grifando
// src/proxy.ts and the headers of next.config.ts (74dbb9f). Grifando's proxy ran before each
// Next.js render; here two Hono middlewares run before every route: one sets the static
// single-page application's CSP and the security headers on every answer, the other is the
// session gate.
import type { SessionSettings } from "@fluenshift/env";
import { Redacted } from "effect";
import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";

import {
  newSessionId,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  signSessionId,
  verifySessionToken,
} from "./session-token";

/**
 * The Content Security Policy of the static single-page application: Grifando's policy with
 * scripts from the same origin only, where its Next.js pages needed a per-request nonce,
 * 'strict-dynamic' and, in development, 'unsafe-eval'. Styles keep 'unsafe-inline' for React
 * style attributes; the frames and the thumbnails are Focus Music's.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://i.ytimg.com",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src https://open.spotify.com https://www.youtube-nocookie.com https://www.youtube.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

// Grifando's next.config.ts headers, which it set on every path, and the policy above.
const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "Content-Security-Policy": CONTENT_SECURITY_POLICY,
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
};

/** Sets the CSP and the security headers on every answer, refusals included. */
export const securityHeaders: MiddlewareHandler = (context, next) => {
  const setHeaders = () => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      context.header(name, value);
    }
  };
  return next().then(setHeaders);
};

/** Grifando's answer to an API request without a valid session. */
export const SESSION_REQUIRED = {
  code: "SESSION_REQUIRED",
  error: "Session expired. Reload the page.",
};

// A new session cookie, written as Next.js wrote it: Path, Expires and Max-Age, Secure in
// production only, HttpOnly and SameSite=lax.
const mintedCookie = (token: string, secure: boolean): string =>
  [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    `Expires=${new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toUTCString()}`,
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    ...(secure ? ["Secure"] : []),
    "HttpOnly",
    "SameSite=lax",
  ].join("; ");

/**
 * The session gate. An API request needs a valid session cookie, or gets 401 SESSION_REQUIRED
 * and no cookie: an API call never mints a session, which would create Learners without bound.
 * The health check is the one exception, for the host's checks. Any other request without a
 * valid session gets a new cookie on its answer, as Grifando's pages did, except the build's
 * static assets, whose answers caches keep.
 */
export const sessionGate =
  ({ secret, secureCookie }: SessionSettings): MiddlewareHandler =>
  (context, next) => {
    const { path } = context.req;
    const valid =
      verifySessionToken(
        getCookie(context, SESSION_COOKIE),
        Redacted.value(secret)
      ) !== null;
    if (path.startsWith("/api/")) {
      return valid || path === "/api/health"
        ? next()
        : Promise.resolve(context.json(SESSION_REQUIRED, 401));
    }
    if (valid || path.startsWith("/assets/")) {
      return next();
    }
    const token = signSessionId(newSessionId(), Redacted.value(secret));
    const setCookie = () => {
      context.header("Set-Cookie", mintedCookie(token, secureCookie), {
        append: true,
      });
    };
    return next().then(setCookie);
  };
