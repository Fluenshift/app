// Characterization of the matcher of src/proxy.ts at the Grifando baseline, which no test reads:
// the proxy, which mints the session cookie, runs on every page but skips Next.js's static
// files, the favicon, the Open Graph image, robots.txt and sitemap.xml.
import { describe, expect, it } from "vitest";

import { config } from "./proxy";

describe("proxy matcher", () => {
  it("leaves robots.txt and sitemap.xml out of the session, which every page gets", () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);

    expect(config.matcher).toEqual([
      "/((?!_next/static|_next/image|favicon.ico|opengraph-image|robots.txt|sitemap.xml).*)",
    ]);
    expect(
      ["/", "/privacy", "/settings", "/technical", "/robots.txt", "/sitemap.xml"].map((path) => [path, matcher.test(path)]),
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
