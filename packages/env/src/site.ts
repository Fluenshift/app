// The public origin of the hosted profile. Ported from getSiteUrl in Grifando src/lib/siteUrl.ts
// (74dbb9f): SITE_URL without its trailing slashes, else http://localhost:3000. Grifando's
// fallback to the Vercel production host is not ported: the hosted profile ships as one Docker
// image, on a host the owners choose (docs/adr/0003, docs/adr/0037).
import { Config, Context, Effect, Layer, Option } from "effect";

const LOCAL_SITE_URL = "http://localhost:3000";

/**
 * The public origin of the hosted profile, which its robots.txt, sitemap.xml and link preview name
 * (docs/adr/0037, docs/adr/0040).
 */
export interface SiteSettings {
  readonly siteUrl: string;
}

// Read as Grifando read NEXT_PUBLIC_SITE_URL: trimmed, and blank as unset.
const siteUrlOf = (configured: Option.Option<string>): string => {
  const explicit = Option.getOrElse(configured, () => "").trim();
  return explicit === "" ? LOCAL_SITE_URL : explicit.replace(/\/+$/u, "");
};

export class SiteConfig extends Context.Service<SiteConfig, SiteSettings>()(
  "@fluenshift/env/SiteConfig"
) {
  static readonly layer = Layer.effect(
    SiteConfig,
    Effect.gen(function* () {
      const configured = yield* Config.option(
        Config.NonEmptyString("SITE_URL")
      );
      return SiteConfig.of({ siteUrl: siteUrlOf(configured) });
    })
  );
}
