// Characterization of src/server/session/sessionToken.ts at the Grifando baseline:
// sessionToken.test.ts round-trips a token without pinning its signature, and its junk tokens fail
// on their signature anyway, so it pins neither the check of the token's parts nor the length check
// that keeps timingSafeEqual from throwing.
import { describe, expect, it } from "vitest";

import { signSessionId, verifySessionToken } from "./sessionToken";

const SECRET = "test-secret-xxxxxxxxxxxxxxxxxxxxxxxxxxxx";

describe("sessionToken", () => {
  it("signs an id with the base64url HMAC-SHA256 of the secret", () => {
    expect(signSessionId("abc", SECRET)).toBe("abc.9dVO1e-XXhENWqwBjqGLsD7lvluxZ78tr3jxUNbWB5c");
  });

  it("rejects a signed token with an extra part, and a signature of another length, without throwing", () => {
    const token = signSessionId("abc", SECRET);
    expect(verifySessionToken(`${token}.extra`, SECRET)).toBeNull();
    expect(verifySessionToken(`${token}x`, SECRET)).toBeNull();
    expect(verifySessionToken(token.slice(0, -1), SECRET)).toBeNull();
  });
});
