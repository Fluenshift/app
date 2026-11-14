import { hc } from "hono/client";
import type { AppType } from "server/app";

/** The only module that talks to the server: a typed Hono client over same-origin requests. */
export const api = hc<AppType>("/");
