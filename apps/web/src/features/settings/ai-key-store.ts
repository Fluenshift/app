// The visitor's Trainer key, kept only in this browser's localStorage (docs/adr/0012). Ported from
// Grifando src/lib/aiKeyStore.ts (74dbb9f). Every access is guarded: storage is missing outside a
// browser, and throws when the browser blocks site data.
import { TRAINER_KEY_PROVIDERS } from "@fluenshift/contract";
import type { TrainerKeyProvider } from "@fluenshift/contract";
import { Option, Schema } from "effect";

/**
 * Thrown before any request is made when the browser holds no key, so the screen can ask the
 * visitor for one. Ported from Grifando src/lib/aiFetch.ts (74dbb9f).
 */
export class MissingAIKeyError extends Error {
  constructor() {
    super("Set up your AI key to get feedback.");
    this.name = "MissingAIKeyError";
  }
}

/** A visitor's key for one Trainer provider. */
export interface AICredentials {
  readonly apiKey: string;
  readonly provider: TrainerKeyProvider;
}

// Kept from Grifando's former name, Inglesando, as Grifando kept it.
const STORAGE_KEY = "inglesando:ai-key";

const StoredKey = Schema.Struct({
  apiKey: Schema.String,
  provider: Schema.Literals(TRAINER_KEY_PROVIDERS),
});
const decodeStoredKey = Schema.decodeUnknownOption(StoredKey);

const browserStorage = (): Storage | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/** The stored key, or null for none, a corrupt one, or storage the browser blocks. */
export const getStoredAIKey = (
  storage: Storage | null = browserStorage()
): AICredentials | null => {
  if (storage === null) {
    return null;
  }
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null || raw === "") {
      return null;
    }
    const stored = Option.getOrNull(decodeStoredKey(JSON.parse(raw)));
    const apiKey = stored?.apiKey.trim() ?? "";
    return stored === null || apiKey === ""
      ? null
      : { apiKey, provider: stored.provider };
  } catch {
    return null;
  }
};

/** Saves the key, trimmed; false when the browser will not store it (blocked or full). */
export const saveAIKey = (
  credentials: AICredentials,
  storage: Storage | null = browserStorage()
): boolean => {
  if (storage === null) {
    return false;
  }
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        apiKey: credentials.apiKey.trim(),
        provider: credentials.provider,
      })
    );
    return true;
  } catch {
    return false;
  }
};

export const clearAIKey = (
  storage: Storage | null = browserStorage()
): void => {
  if (storage === null) {
    return;
  }
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
};
