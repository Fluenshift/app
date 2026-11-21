// Characterization of src/app/robots.ts at the Grifando baseline, which no test calls: every
// crawler may read every path but /api/, and the rules name the sitemap at the public origin.
import { afterEach, describe, expect, it, vi } from "vitest";

import robots from "./robots";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("robots", () => {
  it("allows every crawler everywhere but /api/ and names the sitemap at the public origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://grifando.example/");

    expect(robots()).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: "/api/" },
      sitemap: "https://grifando.example/sitemap.xml",
    });
  });
});
