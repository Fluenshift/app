// Ported from getSiteUrl's test in Grifando src/app/sitemap.test.ts (74dbb9f), port-changed under
// docs/adr/0003 and docs/adr/0037: the hosted profile reads its public origin from SITE_URL
// through Effect Config, and Grifando's fallback to the Vercel production host is gone, since the
// one Docker image runs on a host the owners choose.
import { ConfigProvider, Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import { SiteConfig } from "./site";

const getSiteUrl = (env: Record<string, string>) =>
  Effect.runSync(
    Effect.provide(
      SiteConfig,
      SiteConfig.layer.pipe(
        Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(env)))
      )
    )
  ).siteUrl;

describe("getSiteUrl", () => {
  it("prefers SITE_URL without its trailing slashes, then localhost", () => {
    expect(getSiteUrl({ SITE_URL: "https://a.example/" })).toBe(
      "https://a.example"
    );
    expect(getSiteUrl({ SITE_URL: "https://a.example//" })).toBe(
      "https://a.example"
    );
    expect(getSiteUrl({})).toBe("http://localhost:3000");
    expect(getSiteUrl({ SITE_URL: "   " })).toBe("http://localhost:3000");
  });
});
