// Ported from Grifando src/server/session/sessionToken.test.ts (74dbb9f), with the cases of its
// characterization at the pin (migration/characterization/grifando).
import { describe, expect, it } from "vitest";

import {
  newSessionId,
  signSessionId,
  verifySessionToken,
} from "./session-token";

const SECRET = "test-secret-xxxxxxxxxxxxxxxxxxxxxxxxxxxx";

describe("sessionToken", () => {
  it("round-trips a signed id", () => {
    expect(verifySessionToken(signSessionId("abc", SECRET), SECRET)).toBe(
      "abc"
    );
  });

  it("rejects a tampered id, a wrong secret, and junk", () => {
    const token = signSessionId("abc", SECRET);
    expect(verifySessionToken(token.replace("abc", "abd"), SECRET)).toBeNull();
    expect(
      verifySessionToken(token, "other-secret-xxxxxxxxxxxxxxxxxxxxxxxx")
    ).toBeNull();
    for (const junk of [undefined, "", "abc", ".sig", "a.b.c"]) {
      expect(verifySessionToken(junk, SECRET)).toBeNull();
    }
  });

  it("mints distinct ids", () => {
    expect(newSessionId()).not.toBe(newSessionId());
  });

  it("signs an id with the base64url HMAC-SHA256 of the secret", () => {
    expect(signSessionId("abc", SECRET)).toBe(
      "abc.9dVO1e-XXhENWqwBjqGLsD7lvluxZ78tr3jxUNbWB5c"
    );
  });

  it("rejects a signed token with an extra part, and a signature of another length, without throwing", () => {
    const token = signSessionId("abc", SECRET);
    expect(verifySessionToken(`${token}.extra`, SECRET)).toBeNull();
    expect(verifySessionToken(`${token}x`, SECRET)).toBeNull();
    expect(verifySessionToken(token.slice(0, -1), SECRET)).toBeNull();
  });
});
