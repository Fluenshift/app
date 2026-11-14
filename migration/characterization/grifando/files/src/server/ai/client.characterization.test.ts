// Characterization of src/server/ai/client.ts at the Grifando baseline, for fix commit 80957b6
// ("use gemini-3.5-flash and test keys on the light model"), which came with no test: the
// default model per provider, and that a key test runs on the light fallback model. The key
// tests are faked, so no request leaves the process.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/ai/providers/gemini", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/ai/providers/gemini")>()),
  testKey: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/server/ai/providers/anthropic", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/ai/providers/anthropic")>()),
  testKey: vi.fn(() => Promise.resolve()),
}));

import {
  ANTHROPIC_FALLBACK_MODEL,
  createAIProvider,
  GEMINI_FALLBACK_MODEL,
  testAIKey,
} from "@/server/ai/client";
import { testKey as testAnthropicKey } from "@/server/ai/providers/anthropic";
import { testKey as testGeminiKey } from "@/server/ai/providers/gemini";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("AI client model choice", () => {
  it("answers with gemini-3.5-flash and claude-sonnet-5 unless the environment names a model", () => {
    vi.stubEnv("GEMINI_MODEL", undefined);
    vi.stubEnv("ANTHROPIC_MODEL", undefined);

    expect(createAIProvider({ provider: "gemini", apiKey: "test-key" }).modelId).toBe("gemini-3.5-flash");
    expect(createAIProvider({ provider: "anthropic", apiKey: "test-key" }).modelId).toBe("claude-sonnet-5");
  });

  it("falls back to gemini-3.5-flash-lite and claude-haiku-5-5", () => {
    expect(GEMINI_FALLBACK_MODEL).toBe("gemini-3.5-flash-lite");
    expect(ANTHROPIC_FALLBACK_MODEL).toBe("claude-haiku-5-5");
  });

  it("tests a key on the light fallback model, not the primary one", async () => {
    vi.stubEnv("GEMINI_MODEL", "gemini-3.8-flash");
    vi.stubEnv("ANTHROPIC_MODEL", "claude-opus-5");

    expect(await testAIKey({ provider: "gemini", apiKey: "test-key" })).toBe("works");
    expect(await testAIKey({ provider: "anthropic", apiKey: "test-key" })).toBe("works");
    expect(vi.mocked(testGeminiKey).mock.calls.map(([, model]) => model)).toEqual(["gemini-3.5-flash-lite"]);
    expect(vi.mocked(testAnthropicKey).mock.calls.map(([, model]) => model)).toEqual(["claude-haiku-5-5"]);
  });
});
