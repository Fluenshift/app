// Characterization of getSessionSecret in src/server/session/sessionToken.ts at the Grifando
// baseline: the tests only sign with the development secret it falls back to, and no test
// pins that production refuses to run without SESSION_SECRET (fix 9ba8040 checks it at build).
import { afterEach, describe, expect, it, vi } from "vitest";

import { getSessionSecret } from "./sessionToken";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("getSessionSecret", () => {
  it("returns SESSION_SECRET whenever it is set", () => {
    vi.stubEnv("SESSION_SECRET", "a-configured-secret-xxxxxxxxxxxxxxxxxxxx");
    vi.stubEnv("NODE_ENV", "production");
    expect(getSessionSecret()).toBe("a-configured-secret-xxxxxxxxxxxxxxxxxxxx");
  });

  it("refuses to run in production without SESSION_SECRET", () => {
    vi.stubEnv("SESSION_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getSessionSecret()).toThrow("SESSION_SECRET is not set — it is required in production.");
  });

  it("falls back to an insecure development secret, with a warning, outside production", () => {
    vi.stubEnv("SESSION_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getSessionSecret()).toBe("dev-only-session-secret-do-not-use-in-production");
    expect(warn).toHaveBeenCalledWith("SESSION_SECRET is not set — using an insecure development secret.");
  });
});
