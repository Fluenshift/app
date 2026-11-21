// Ported from Grifando src/lib/aiKeyStore.test.ts (74dbb9f), with the case of its characterization.
// The web suite runs in jsdom, where a window always exists, so the case outside the browser
// removes it for its one call.
import { afterEach, describe, expect, it, vi } from "vitest";

import { aiFetch } from "../../api";
import {
  clearAIKey,
  getStoredAIKey,
  MissingAIKeyError,
  saveAIKey,
} from "./ai-key-store";

const memoryStorage = (): Storage => {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => {
      data.clear();
    },
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, String(value));
    },
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("aiKeyStore", () => {
  it("saves a trimmed key and reads it back", () => {
    const storage = memoryStorage();
    saveAIKey({ apiKey: " k \n", provider: "gemini" }, storage);
    expect(getStoredAIKey(storage)).toEqual({
      apiKey: "k",
      provider: "gemini",
    });
  });

  it("returns null for corrupt stored JSON", () => {
    const storage = memoryStorage();
    storage.setItem("inglesando:ai-key", "{not json");
    expect(getStoredAIKey(storage)).toBeNull();
  });

  it("returns null for a stored value with an unknown provider or empty key", () => {
    const storage = memoryStorage();
    storage.setItem(
      "inglesando:ai-key",
      JSON.stringify({ apiKey: "k", provider: "openai" })
    );
    expect(getStoredAIKey(storage)).toBeNull();
    storage.setItem(
      "inglesando:ai-key",
      JSON.stringify({ apiKey: "", provider: "gemini" })
    );
    expect(getStoredAIKey(storage)).toBeNull();
  });

  it("clears the stored key", () => {
    const storage = memoryStorage();
    saveAIKey({ apiKey: "k", provider: "anthropic" }, storage);
    clearAIKey(storage);
    expect(getStoredAIKey(storage)).toBeNull();
  });

  it("returns null when storage throws (blocked site data)", () => {
    const storage = memoryStorage();
    storage.getItem = () => {
      throw new Error("SecurityError");
    };
    expect(getStoredAIKey(storage)).toBeNull();
  });

  it("returns null outside the browser", () => {
    vi.stubGlobal("window", undefined);
    const stored = getStoredAIKey();
    vi.unstubAllGlobals();
    expect(stored).toBeNull();
  });
});

describe("aiKeyStore reading", () => {
  it("trims a stored key and reads a blank one as none", () => {
    const storage = memoryStorage();
    storage.setItem(
      "inglesando:ai-key",
      JSON.stringify({ apiKey: " k \n", provider: "gemini" })
    );
    expect(getStoredAIKey(storage)).toEqual({
      apiKey: "k",
      provider: "gemini",
    });
    storage.setItem(
      "inglesando:ai-key",
      JSON.stringify({ apiKey: "  ", provider: "anthropic" })
    );
    expect(getStoredAIKey(storage)).toBeNull();
  });
});

describe("aiFetch", () => {
  it("refuses absolute and protocol-relative URLs without calling fetch", async () => {
    const storage = memoryStorage();
    saveAIKey({ apiKey: "secret-key", provider: "gemini" }, storage);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", { localStorage: storage });

    await expect(aiFetch("https://evil.example/api")).rejects.toThrow(
      /same-origin/u
    );
    await expect(aiFetch("//evil.example/api")).rejects.toThrow(/same-origin/u);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("saveAIKey reports false when storage throws", () => {
    const blocked = {
      setItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(saveAIKey({ apiKey: "k", provider: "gemini" }, blocked)).toBe(false);
    expect(
      saveAIKey({ apiKey: "k", provider: "gemini" }, memoryStorage())
    ).toBe(true);
  });

  it("rejects with MissingAIKeyError and never calls fetch when no key is stored", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", { localStorage: memoryStorage() });

    await expect(
      aiFetch("/api/writing-sessions", { method: "POST" })
    ).rejects.toBeInstanceOf(MissingAIKeyError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the provider and key headers, keeping the caller's headers", async () => {
    const storage = memoryStorage();
    saveAIKey({ apiKey: "secret-key", provider: "gemini" }, storage);
    const fetchMock = vi.fn(() => Promise.resolve(new Response("{}")));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", { localStorage: storage });

    await aiFetch("/api/writing-sessions", {
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/writing-sessions");
    const headers = new Headers(init.headers);
    expect(headers.get("x-ai-provider")).toBe("gemini");
    expect(headers.get("x-ai-key")).toBe("secret-key");
    expect(headers.get("content-type")).toBe("application/json");
    expect(init.method).toBe("POST");
  });
});
