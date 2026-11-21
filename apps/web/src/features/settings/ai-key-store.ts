// The visitor's Trainer key, kept only in this browser's localStorage (docs/adr/0012). Ported from
// Grifando src/lib/aiKeyStore.ts (74dbb9f). Every access is guarded: storage is missing outside a
// browser, and throws when the browser blocks site data.
import type { TrainerKeyProvider } from "@fluenshift/contract";

/** A visitor's key for one Trainer provider. */
export interface AICredentials {
  readonly apiKey: string;
  readonly provider: TrainerKeyProvider;
}

// Stubs: a placeholder key, a save that always succeeds, a clear that does nothing.
export const getStoredAIKey = (
  _storage: Storage | null = null
): AICredentials | null => ({ apiKey: "placeholder", provider: "gemini" });

export const saveAIKey = (
  _credentials: AICredentials,
  _storage: Storage | null = null
): boolean => true;

export const clearAIKey = (_storage: Storage | null = null): void => {
  // Stub.
};
