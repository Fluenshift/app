// The hosted profile's robots.txt and sitemap.xml, which Next.js generated for Grifando from
// src/app/robots.ts and src/app/sitemap.ts (74dbb9f), written as the text crawlers read
// (docs/adr/0003, docs/adr/0037).

// Only public, content-stable routes. Per-Learner pages stay out.
const PUBLIC_PATHS = ["/", "/technical", "/privacy", "/settings"] as const;

/** The paths the session gate leaves without a cookie, as Grifando's proxy matcher did. */
export const SITE_FILE_PATHS: ReadonlySet<string> = new Set([
  "/robots.txt",
  "/sitemap.xml",
]);

/** Every crawler may read every path but the API; the rules name the sitemap. */
export const robotsTxt = (siteUrl: string): string =>
  `User-Agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${siteUrl}/sitemap.xml\n`;

/** The public routes at the public origin, in the sitemaps.org format. */
export const sitemapXml = (siteUrl: string): string =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...PUBLIC_PATHS.map(
      (path) => `<url>\n<loc>${siteUrl}${path}</loc>\n</url>`
    ),
    "</urlset>",
    "",
  ].join("\n");
