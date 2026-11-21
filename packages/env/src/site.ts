import { Config, Context, Effect, Layer } from "effect";

/** The public origin of the hosted profile, which its robots.txt and sitemap.xml name. */
export interface SiteSettings {
  readonly siteUrl: string;
}

export class SiteConfig extends Context.Service<SiteConfig, SiteSettings>()(
  "@fluenshift/env/SiteConfig"
) {
  static readonly layer = Layer.effect(
    SiteConfig,
    Effect.gen(function* () {
      yield* Config.option(Config.NonEmptyString("SITE_URL"));
      return SiteConfig.of({ siteUrl: "" });
    })
  );
}
