// The Academy client the Academy screens use. The app runs on the HTTP client of `src/api.ts`,
// the screen tests on the in-memory client (docs/adr/0025); the types are the Academy contract's.
import type { DailyChallenge } from "@fluenshift/contract";

export interface AcademyClient {
  readonly getDailyChallenge: () => Promise<DailyChallenge>;
}

/**
 * The client of a router built without one, as the Evaluation screen tests build it: every read
 * fails, so an Academy screen never shows data that did not come from a client.
 */
export const unavailableAcademyClient: AcademyClient = {
  getDailyChallenge: () =>
    Promise.reject(new Error("The Academy client is not available")),
};
