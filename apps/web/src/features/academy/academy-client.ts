// The Academy client the Academy screens use. The app runs on the HTTP client of `src/api.ts`,
// the screen tests on the in-memory client (docs/adr/0025); the types are the Academy contract's.
import type {
  AcademyDashboard,
  DailyChallenge,
  MistakeNotebook,
  VocabularyItem,
  VocabularyItemRequest,
} from "@fluenshift/contract";

export interface AcademyClient {
  readonly createVocabularyItem: (
    request: VocabularyItemRequest
  ) => Promise<void>;
  /** Resolves once the item is gone, also when it was already gone. */
  readonly deleteVocabularyItem: (itemId: string) => Promise<void>;
  readonly getAcademyDashboard: () => Promise<AcademyDashboard>;
  readonly getDailyChallenge: () => Promise<DailyChallenge>;
  readonly getMistakeNotebook: () => Promise<MistakeNotebook>;
  readonly listVocabulary: () => Promise<readonly VocabularyItem[]>;
}

const unavailable = () =>
  Promise.reject(new Error("The Academy client is not available"));

/**
 * The client of a router built without one, as the Evaluation screen tests build it: every call
 * fails, so an Academy screen never shows data that did not come from a client.
 */
export const unavailableAcademyClient: AcademyClient = {
  createVocabularyItem: unavailable,
  deleteVocabularyItem: unavailable,
  getAcademyDashboard: unavailable,
  getDailyChallenge: unavailable,
  getMistakeNotebook: unavailable,
  listVocabulary: unavailable,
};
