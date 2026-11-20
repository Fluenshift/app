// Ported from Grifando src/server/session/sessionToken.ts (74dbb9f). The secret comes from
// SessionConfig (@fluenshift/env), which replaces getSessionSecret.
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

/** The cookie that carries a hosted Learner's signed session id. */
export const SESSION_COOKIE = "ig_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const sign = (id: string, secret: string): string =>
  createHmac("sha256", secret).update(id).digest("base64url");

/** A session id and its HMAC, as the cookie carries them. */
export const signSessionId = (id: string, secret: string): string =>
  `${id}.${sign(id, secret)}`;

/** The session id a token carries, or null for a token that `secret` did not sign. */
export const verifySessionToken = (
  token: string | undefined,
  secret: string
): string | null => {
  if (token === undefined || token === "") {
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }
  const [id, signature] = parts;
  if (
    id === undefined ||
    id === "" ||
    signature === undefined ||
    signature === ""
  ) {
    return null;
  }
  const expected = Buffer.from(sign(id, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }
  return id;
};

export const newSessionId = (): string => randomUUID();
