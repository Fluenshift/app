// The hosted profile's request pipeline (docs/adr/0003, docs/adr/0032), ported from Grifando
// src/proxy.ts and the headers of next.config.ts (74dbb9f). Grifando's proxy ran before each
// Next.js render; here two Hono middlewares run before every route: one sets the static
// single-page application's CSP and the security headers on every answer, the other is the
// session gate.
import type { SessionSettings } from "@fluenshift/env";
import type { MiddlewareHandler } from "hono";

// Stubs: no policy and no headers, and a gate that refuses every request with a placeholder
// cookie.
export const CONTENT_SECURITY_POLICY = "";

export const securityHeaders: MiddlewareHandler = (_context, next) => next();

export const sessionGate =
  (_settings: SessionSettings): MiddlewareHandler =>
  (context) =>
    Promise.resolve(
      context.body(null, 401, { "Set-Cookie": "placeholder=; Path=/" })
    );
