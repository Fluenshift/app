// The caps the setup status hands the web app (docs/adr/0006), read from each Deploy Profile's
// configuration.
import { ServerConfig } from "@fluenshift/env";
import { ConfigProvider, Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import { sampleLimitsOf } from "./sample-limits";

const limitsOf = (environment: Record<string, string>) =>
  Effect.runPromise(
    ServerConfig.pipe(
      Effect.map((config) => sampleLimitsOf(config.limits)),
      Effect.provide(
        ServerConfig.layer.pipe(
          Layer.provide(
            ConfigProvider.layer(ConfigProvider.fromEnvRecord(environment))
          )
        )
      )
    )
  );

describe("sampleLimitsOf", () => {
  it("gives the local profile PE's 32 KiB and no character cap", async () => {
    expect(await limitsOf({ DATA_DIRECTORY: "/data/pglite" })).toStrictEqual({
      codeMaxCharacters: null,
      sampleMaxBytes: 32_768,
      sampleMaxCharacters: null,
    });
  });

  it("gives the hosted profile Grifando's 5000 characters within the same 32 KiB", async () => {
    expect(
      await limitsOf({
        DATABASE_URL: "postgres://app@db:5432/app",
        DEPLOY_PROFILE: "hosted",
      })
    ).toStrictEqual({
      codeMaxCharacters: 2000,
      sampleMaxBytes: 32_768,
      sampleMaxCharacters: 5000,
    });
  });
});
