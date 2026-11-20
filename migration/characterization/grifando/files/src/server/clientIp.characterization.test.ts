// Characterization of src/server/clientIp.ts at the Grifando baseline: clientIp.test.ts checks the
// hash's shape and stability, not that it covers the salt with the IP, and no test reads
// getIpHashSalt, which production requires (fix 9ba8040 checks it at build).
import { afterEach, describe, expect, it, vi } from "vitest";

import { getIpHashSalt, hashedClientIp } from "./clientIp";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getIpHashSalt", () => {
  it("returns IP_HASH_SALT whenever it is set", () => {
    vi.stubEnv("IP_HASH_SALT", "a-configured-salt");
    vi.stubEnv("NODE_ENV", "production");
    expect(getIpHashSalt()).toBe("a-configured-salt");
  });

  it("refuses to run in production without IP_HASH_SALT", () => {
    vi.stubEnv("IP_HASH_SALT", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getIpHashSalt()).toThrow("IP_HASH_SALT is not set — it is required in production.");
  });

  it("falls back to a fixed development salt outside production", () => {
    vi.stubEnv("IP_HASH_SALT", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(getIpHashSalt()).toBe("dev-only-ip-hash-salt-do-not-use-in-production");
  });
});

describe("hashedClientIp", () => {
  it("hashes the salt followed by the IP with SHA-256, keeping 32 hex digits", () => {
    vi.stubEnv("IP_HASH_SALT", "characterization-salt");
    // sha256("characterization-salt" + "203.0.113.9"), its first 32 hex digits.
    expect(hashedClientIp(new Headers({ "x-forwarded-for": "203.0.113.9" }))).toBe("dfecc2b068b5f8ede4c6fb9d5433d3c5");
  });
});
