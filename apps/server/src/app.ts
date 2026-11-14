import type { HealthResponse } from "@fluenshift/contract";
import { Hono } from "hono";

/** The HTTP application. Routes join through the typed Effect edge helper (Phase 2 step 3). */
export const createApp = () =>
  new Hono().get("/api/health", (context) =>
    context.json({ status: "ok" } satisfies HealthResponse)
  );

export type AppType = ReturnType<typeof createApp>;
