// Ported from Grifando src/server/clientIp.test.ts (74dbb9f), with the case of its characterization:
// hashedClientIp takes the settings ClientIpConfig reads, here from an environment that names no salt
// and no header, so the development salt and x-forwarded-for, as Grifando's tests ran.
import { ClientIpConfig } from "@fluenshift/env";
import { ConfigProvider, Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import { hashedClientIp as hashed } from "./client-ip";

const settingsWith = (env: Record<string, string>) =>
  Effect.runSync(
    Effect.provide(
      ClientIpConfig,
      ClientIpConfig.layer.pipe(
        Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(env)))
      )
    )
  );

const defaults = settingsWith({});

const hashedClientIp = (headers: Headers) => hashed(headers, defaults);

const headers = (xff?: string) =>
  new Headers(xff === undefined ? {} : { "x-forwarded-for": xff });

describe("hashedClientIp", () => {
  it("never returns the raw IP and is stable for the same input", () => {
    const hash = hashedClientIp(headers("203.0.113.9"));
    expect(hash).not.toContain("203.0.113.9");
    expect(hash).toMatch(/^[0-9a-f]{32}$/u);
    expect(hashedClientIp(headers("203.0.113.9"))).toBe(hash);
  });

  it("uses only the first x-forwarded-for entry", () => {
    expect(hashedClientIp(headers(" 203.0.113.9 , 10.0.0.1"))).toBe(
      hashedClientIp(headers("203.0.113.9"))
    );
  });

  it("differs per IP and falls back to a stable value when missing", () => {
    expect(hashedClientIp(headers("1.1.1.1"))).not.toBe(
      hashedClientIp(headers("2.2.2.2"))
    );
    expect(hashedClientIp(headers())).toBe(hashedClientIp(headers()));
  });

  it("hashes the salt followed by the IP with SHA-256, keeping 32 hex digits", () => {
    expect(
      hashed(
        new Headers({ "x-forwarded-for": "203.0.113.9" }),
        settingsWith({ IP_HASH_SALT: "characterization-salt" })
      )
    ).toBe("dfecc2b068b5f8ede4c6fb9d5433d3c5");
  });

  it("reads the client IP from the header the deployment names", () => {
    expect(
      hashed(
        new Headers({
          "fly-client-ip": "203.0.113.9",
          "x-forwarded-for": "10.0.0.1",
        }),
        settingsWith({ CLIENT_IP_HEADER: "fly-client-ip" })
      )
    ).toBe(hashedClientIp(headers("203.0.113.9")));
  });
});
