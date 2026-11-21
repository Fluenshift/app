// The hosted profile's robots.txt and sitemap.xml, which Next.js generated for Grifando from
// src/app/robots.ts and src/app/sitemap.ts (74dbb9f), written as the text crawlers read
// (docs/adr/0003, docs/adr/0037), and the tags of its Open Graph card, from
// src/app/opengraph-image.tsx (docs/adr/0040).

// Only public, content-stable routes. Per-Learner pages stay out.
const PUBLIC_PATHS = ["/", "/technical", "/privacy", "/settings"] as const;

/** Grifando's Open Graph card, a static file at the root of the web build (docs/adr/0040). */
export const OG_IMAGE_PATH = "/og-image.png";

/** The paths the session gate leaves without a cookie, as Grifando's proxy matcher did. */
export const SITE_FILE_PATHS: ReadonlySet<string> = new Set([
  "/robots.txt",
  "/sitemap.xml",
  OG_IMAGE_PATH,
]);

const OG_IMAGE_ALT =
  "Fluenshift — a personal English coach built from your own mistakes";

const escapeAttribute = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

/**
 * The application shell with the tags Next.js wrote for Grifando's Open Graph card, its URL at
 * the public origin, which no build can know (docs/adr/0040).
 */
export const withLinkPreview =
  (siteUrl: string) =>
  (shell: string): string => {
    const tags = (
      [
        ["og:image", `${siteUrl}${OG_IMAGE_PATH}`],
        ["og:image:type", "image/png"],
        ["og:image:width", "1200"],
        ["og:image:height", "630"],
        ["og:image:alt", OG_IMAGE_ALT],
      ] as const
    )
      .map(
        ([property, content]) =>
          `<meta property="${property}" content="${escapeAttribute(content)}" />\n`
      )
      .join("");
    return shell.replace("</head>", () => `${tags}</head>`);
  };

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
