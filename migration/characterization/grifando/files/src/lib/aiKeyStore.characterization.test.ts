// Characterization of getStoredAIKey in src/lib/aiKeyStore.ts at the Grifando baseline:
// aiKeyStore.test.ts reads back keys that saveAIKey already trimmed, and an empty one, so it pins
// neither that reading trims a stored key nor that a blank one reads as none.
import { describe, expect, it } from "vitest";

import { getStoredAIKey } from "./aiKeyStore";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

describe("aiKeyStore reading", () => {
  it("trims a stored key and reads a blank one as none", () => {
    const storage = memoryStorage();
    storage.setItem("inglesando:ai-key", JSON.stringify({ provider: "gemini", apiKey: " k \n" }));
    expect(getStoredAIKey(storage)).toEqual({ provider: "gemini", apiKey: "k" });
    storage.setItem("inglesando:ai-key", JSON.stringify({ provider: "anthropic", apiKey: "  " }));
    expect(getStoredAIKey(storage)).toBeNull();
  });
});
