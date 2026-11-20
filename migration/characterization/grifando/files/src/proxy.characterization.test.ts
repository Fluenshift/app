// Characterization of src/proxy.ts at the Grifando baseline: proxy.test.ts checks that a minted
// session cookie is HttpOnly and SameSite=Lax, not its path, its lifetime or when it is Secure.
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { proxy } from "./proxy";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

// Everything after the cookie's value, which is a fresh signed id each time.
function attributesOf(response: Response) {
  const cookie = response.headers.get("set-cookie") ?? "";
  return cookie.slice(cookie.indexOf(";"));
}

describe("proxy session cookie", () => {
  it("mints the session cookie site-wide for a year, Secure in production only", () => {
    vi.useFakeTimers({ now: new Date("2026-11-20T12:00:00.000Z"), toFake: ["Date"] });
    vi.stubEnv("SESSION_SECRET", "characterization-secret-xxxxxxxxxxxxxxxx");
    vi.stubEnv("NODE_ENV", "development");
    const development = attributesOf(proxy(new NextRequest("http://127.0.0.1:3000/")));
    vi.stubEnv("NODE_ENV", "production");
    const production = attributesOf(proxy(new NextRequest("http://127.0.0.1:3000/")));

    expect(development).toBe("; Path=/; Expires=Sat, 20 Nov 2027 12:00:00 GMT; Max-Age=31536000; HttpOnly; SameSite=lax");
    expect(production).toBe(
      "; Path=/; Expires=Sat, 20 Nov 2027 12:00:00 GMT; Max-Age=31536000; Secure; HttpOnly; SameSite=lax",
    );
  });
});
