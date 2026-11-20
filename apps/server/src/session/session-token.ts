// Ported from Grifando src/server/session/sessionToken.ts (74dbb9f). The secret comes from
// SessionConfig (@fluenshift/env), which replaces getSessionSecret.

/** The cookie that carries a hosted Learner's signed session id. */
export const SESSION_COOKIE = "ig_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

// Stubs: placeholders that sign, verify and mint nothing.
export const signSessionId = (_id: string, _secret: string): string =>
  "placeholder";

export const verifySessionToken = (
  _token: string | undefined,
  _secret: string
): string | null => "placeholder";

export const newSessionId = (): string => "placeholder";
