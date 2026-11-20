// Ported from the characterization of getIpHashSalt (Grifando src/server/clientIp.ts, 74dbb9f):
// ClientIpConfig reads the salt through Effect Config, so a salt is compared on what it reveals, and
// production without one fails the layer, which stops the server at startup (docs/adr/0033).
import { ConfigProvider, Effect, Layer, Redacted } from "effect";
import { describe, expect, it } from "vitest";

import { ClientIpConfig } from "./client-ip";

const clientIpWith = (env: Record<string, string>) =>
  Effect.runSync(
    Effect.provide(
      ClientIpConfig,
      ClientIpConfig.layer.pipe(
        Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(env)))
      )
    )
  );

const getIpHashSalt = (env: Record<string, string>) =>
  Redacted.value(clientIpWith(env).salt);

describe("getIpHashSalt", () => {
  it("returns IP_HASH_SALT whenever it is set", () => {
    expect(
      getIpHashSalt({
        IP_HASH_SALT: "a-configured-salt",
        NODE_ENV: "production",
      })
    ).toBe("a-configured-salt");
  });

  it("refuses to run in production without IP_HASH_SALT", () => {
    expect(() =>
      getIpHashSalt({ IP_HASH_SALT: "", NODE_ENV: "production" })
    ).toThrow("IP_HASH_SALT is not set — it is required in production.");
  });

  it("falls back to a fixed development salt outside production", () => {
    expect(getIpHashSalt({ IP_HASH_SALT: "", NODE_ENV: "development" })).toBe(
      "dev-only-ip-hash-salt-do-not-use-in-production"
    );
  });
});

describe("ClientIpConfig", () => {
  it("reads the client IP from the header CLIENT_IP_HEADER names, x-forwarded-for by default", () => {
    expect(clientIpWith({}).header).toBe("x-forwarded-for");
    expect(clientIpWith({ CLIENT_IP_HEADER: "fly-client-ip" }).header).toBe(
      "fly-client-ip"
    );
  });
});
