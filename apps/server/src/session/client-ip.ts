// Ported from hashedClientIp in Grifando src/server/clientIp.ts (74dbb9f): the header that carries
// the client IP and the salt come from ClientIpConfig (@fluenshift/env), x-forwarded-for unless
// the deployment names the header its proxy sets (docs/adr/0033).
import { randomUUID } from "node:crypto";

import type { ClientIpSettings } from "@fluenshift/env";

// Stub: a fresh placeholder each time, never a hash of the IP.
export const hashedClientIp = (
  _headers: Headers,
  _settings: ClientIpSettings
): string => randomUUID();
