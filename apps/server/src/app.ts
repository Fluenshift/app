// Typed stub for the red commit: a static server that guards nothing. It answers any file of
// the web build and 501 for everything else, so no check passes yet.
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { DeployProfile, InputLimits } from "@fluenshift/env";
import { Hono } from "hono";

export interface AppOptions {
  readonly limits: InputLimits;
  readonly profile: DeployProfile;
  readonly serveWeb: boolean;
  readonly webDistPath: string;
}

export const createApp = ({ webDistPath }: AppOptions) =>
  new Hono()
    .get("/api/health", (context) =>
      context.json({ status: "ok" as const }, 501)
    )
    .all("*", (context) =>
      readFile(
        path.join(
          webDistPath,
          decodeURIComponent(new URL(context.req.url).pathname)
        )
      ).then(
        (file) => context.body(file),
        () => context.json({ code: "not-implemented" }, 501)
      )
    );

export type AppType = ReturnType<typeof createApp>;
