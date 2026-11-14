import { describe, expect, it } from "vitest";

import { createApp } from "./app";

describe("HTTP application", () => {
  it("answers the health check", async () => {
    const response = await createApp().request("/api/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({ status: "ok" });
  });

  it("answers 404 for an unknown API route", async () => {
    const response = await createApp().request("/api/unknown");

    expect(response.status).toBe(404);
  });
});
