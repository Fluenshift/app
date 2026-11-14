// Characterization of src/lib/responseError.ts at the Grifando baseline, for fix commit 032c115
// ("keep retry session id on typed AI errors"): failedSessionIdFrom, which the writing,
// Explain Code and interview screens use to resubmit a failed text, has no test.
import { describe, expect, it } from "vitest";

import { errorMessageFor, failedSessionIdFrom } from "@/lib/responseError";

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("failedSessionIdFrom", () => {
  it("reads the FAILED session id from a clone, leaving the body for errorMessageFor", async () => {
    const response = jsonResponse(
      { error: "The AI provider is busy right now.", code: "AI_UNAVAILABLE", sessionId: "session-1" },
      503,
    );

    expect(await failedSessionIdFrom(response)).toBe("session-1");
    expect(await errorMessageFor(response, "Something went wrong.")).toBe("The AI provider is busy right now.");
  });

  it("answers undefined without a string session id or without a JSON body", async () => {
    expect(await failedSessionIdFrom(jsonResponse({ code: "AI_UNAVAILABLE", sessionId: 42 }, 503))).toBeUndefined();
    expect(await failedSessionIdFrom(jsonResponse({ code: "AI_UNAVAILABLE" }, 503))).toBeUndefined();
    expect(await failedSessionIdFrom(new Response("Internal Server Error", { status: 500 }))).toBeUndefined();
  });
});
