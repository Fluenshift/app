// Ported from hashedClientIp in Grifando src/server/clientIp.ts (74dbb9f): the header that carries
// the client IP and the salt come from ClientIpConfig (@fluenshift/env), x-forwarded-for unless
// the deployment names the header its proxy sets (docs/adr/0033).
import { createHash } from "node:crypto";

import type { ClientIpSettings } from "@fluenshift/env";
import { Redacted } from "effect";

/** A salted, truncated hash of the request's client IP: the raw IP is never stored or logged. */
export const hashedClientIp = (
  headers: Headers,
  { header, salt }: ClientIpSettings
): string => {
  const first = headers.get(header)?.split(",")[0]?.trim();
  const ip = first === undefined || first === "" ? "unknown" : first;
  return createHash("sha256")
    .update(Redacted.value(salt) + ip)
    .digest("hex")
    .slice(0, 32);
};
