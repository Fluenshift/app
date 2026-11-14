// Characterization of src/server/ai/aiErrorResponse.ts at the Grifando baseline, for fix commit
// 032c115 ("keep retry session id on typed AI errors"): its tests pin the session id on the
// error, not the response body that carries it to the client.
import { describe, expect, it } from "vitest";

import { aiErrorResponse } from "@/server/ai/aiErrorResponse";
import { AIProviderUnavailableError, AIQuotaExceededError } from "@/server/ai/errors";

describe("aiErrorResponse guards", () => {
  it("carries the FAILED session id of a typed AI error, and only when there is one", async () => {
    const withSession = new AIProviderUnavailableError();
    withSession.sessionId = "session-1";
    const saved = aiErrorResponse(withSession);
    const unsaved = aiErrorResponse(new AIQuotaExceededError());

    expect(saved?.status).toBe(503);
    expect(await saved?.json()).toEqual({
      error: "The AI provider is busy right now. Your text is saved — try again in a minute.",
      code: "AI_UNAVAILABLE",
      sessionId: "session-1",
    });
    expect(unsaved?.status).toBe(429);
    expect(await unsaved?.json()).toEqual({
      error: "Your AI key has used up its quota for now. Try again later or use another key.",
      code: "AI_QUOTA_EXCEEDED",
    });
    expect(aiErrorResponse(new Error("not an AI access error"))).toBeNull();
  });
});
