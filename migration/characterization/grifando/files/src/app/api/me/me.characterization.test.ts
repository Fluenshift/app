// Characterization of src/app/api/me/route.ts at the Grifando baseline: route.test.ts pins the
// cookie's name and expiry, not the attributes it is expired with.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/db/client", () => ({ prisma: {} }));
vi.mock("@/server/session/currentUser", () => ({
  getCurrentUserId: vi.fn(async () => "visitor-1"),
  ensureUser: vi.fn(async () => undefined),
}));
vi.mock("@/server/rateLimit", () => ({ rateLimitResponse: async () => null }));
vi.mock("@/server/domain/privacy/cleanup", () => ({ deleteUserData: vi.fn(async () => undefined) }));

import { DELETE } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("DELETE /api/me guards", () => {
  it("expires the session cookie as HttpOnly, SameSite=Lax and site-wide, Secure in production only", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const development = (await DELETE(new Request("http://test/api/me", { method: "DELETE" }))).headers.get("set-cookie");
    vi.stubEnv("NODE_ENV", "production");
    const production = (await DELETE(new Request("http://test/api/me", { method: "DELETE" }))).headers.get("set-cookie");

    expect(development).toBe("ig_session=; Path=/; Max-Age=0; HttpOnly; SameSite=lax");
    expect(production).toBe("ig_session=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=lax");
  });
});
