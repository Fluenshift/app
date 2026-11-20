// Ported from the characterization of getSessionSecret (Grifando src/server/session/sessionToken.ts,
// 74dbb9f): SessionConfig reads the secret through Effect Config, so a secret is compared on what
// it reveals, and production without one fails the layer, which stops the server at startup,
// instead of throwing on each request (docs/adr/0032). The warning goes through Effect's logger.
import { ConfigProvider, Effect, Layer, Logger, Redacted } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SessionConfig } from "./session";

const warn = vi.fn();

// Every warning the layer logs, with the arguments it was logged with.
const keepWarnings = Logger.layer([
  Logger.make(({ logLevel, message }) => {
    if (logLevel === "Warn") {
      warn(...(Array.isArray(message) ? message : [message]));
    }
  }),
]);

const sessionWith = (env: Record<string, string>) =>
  Effect.runSync(
    Effect.provide(
      SessionConfig,
      SessionConfig.layer.pipe(
        Layer.provide(
          Layer.mergeAll(
            ConfigProvider.layer(ConfigProvider.fromEnvRecord(env)),
            keepWarnings
          )
        )
      )
    )
  );

const getSessionSecret = (env: Record<string, string>) =>
  Redacted.value(sessionWith(env).secret);

afterEach(() => {
  warn.mockReset();
});

describe("getSessionSecret", () => {
  it("returns SESSION_SECRET whenever it is set", () => {
    expect(
      getSessionSecret({
        NODE_ENV: "production",
        SESSION_SECRET: "a-configured-secret-xxxxxxxxxxxxxxxxxxxx",
      })
    ).toBe("a-configured-secret-xxxxxxxxxxxxxxxxxxxx");
  });

  it("refuses to run in production without SESSION_SECRET", () => {
    expect(() =>
      getSessionSecret({ NODE_ENV: "production", SESSION_SECRET: "" })
    ).toThrow("SESSION_SECRET is not set — it is required in production.");
  });

  it("falls back to an insecure development secret, with a warning, outside production", () => {
    expect(
      getSessionSecret({ NODE_ENV: "development", SESSION_SECRET: "" })
    ).toBe("dev-only-session-secret-do-not-use-in-production");
    expect(warn).toHaveBeenCalledWith(
      "SESSION_SECRET is not set — using an insecure development secret."
    );
  });
});

describe("SessionConfig", () => {
  it("sets the session cookie Secure in production only", () => {
    expect(
      sessionWith({ NODE_ENV: "production", SESSION_SECRET: "secret" })
        .secureCookie
    ).toBe(true);
    expect(
      sessionWith({ NODE_ENV: "development", SESSION_SECRET: "secret" })
        .secureCookie
    ).toBe(false);
    expect(sessionWith({ NODE_ENV: "test" }).secureCookie).toBe(false);
  });
});
