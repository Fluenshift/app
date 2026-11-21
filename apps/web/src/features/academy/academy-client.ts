// The Academy client the Academy screens use. The app runs on the HTTP client of `src/api.ts`,
// the screen tests on the in-memory client (docs/adr/0025); the types are the Academy contract's.
import type {
  AcademyDashboard,
  DailyChallenge,
  ExerciseGenerationRequest,
  GradedAttempt,
  InterviewAnswerResult,
  KeyTestStatus,
  MistakeNotebook,
  PendingExercise,
  PracticeWritingResult,
  SampleLimits,
  StartedInterview,
  VocabularyItem,
  VocabularyItemRequest,
} from "@fluenshift/contract";

import { MissingAIKeyError } from "../settings/ai-key-store";

export interface AcademyClient {
  /** One answer to an interview turn, evaluated as practice writing (ADR 0010, ADR 0024). */
  readonly answerInterviewTurn: (
    sessionId: string,
    turnId: string,
    answer: string
  ) => Promise<InterviewAnswerResult>;
  readonly createVocabularyItem: (
    request: VocabularyItemRequest
  ) => Promise<void>;
  /**
   * Deletes the hosted Learner and all their data, and expires the session, so only a page load
   * starts a new one (`DELETE /api/me`, ADR 0003, ADR 0036). It reaches no provider.
   */
  readonly deleteLearner: () => Promise<void>;
  /** Resolves once the item is gone, also when it was already gone. */
  readonly deleteVocabularyItem: (itemId: string) => Promise<void>;
  /** Ends an interview; a failure is ignored, as Grifando's wrap-up showed regardless. */
  readonly endInterview: (sessionId: string) => Promise<void>;
  /** The Trainer's explanation of one graded Attempt; it never changes the grade. */
  readonly explainAttempt: (
    exerciseId: string,
    attemptId: string
  ) => Promise<string>;
  /** A new practice set from the Learner's patterns, written by the Trainer. */
  readonly generateExercises: (
    request: ExerciseGenerationRequest
  ) => Promise<readonly PendingExercise[]>;
  readonly getAcademyDashboard: () => Promise<AcademyDashboard>;
  readonly getDailyChallenge: () => Promise<DailyChallenge>;
  readonly getMistakeNotebook: () => Promise<MistakeNotebook>;
  /** The Deploy Profile's caps on one Writing Sample, which size the writing sheets (ADR 0006). */
  readonly getSampleLimits: () => Promise<SampleLimits>;
  readonly listPendingExercises: () => Promise<readonly PendingExercise[]>;
  readonly listVocabulary: () => Promise<readonly VocabularyItem[]>;
  readonly startInterview: () => Promise<StartedInterview>;
  readonly submitAttempt: (
    exerciseId: string,
    answer: string
  ) => Promise<GradedAttempt>;
  /** Tests the browser's key with its provider, which says whether it works (ADR 0034). */
  readonly testAIKey: () => Promise<KeyTestStatus>;
  /** Practice writing: the Judge's Evaluation, then the Enrichment's Occurrences (ADR 0026). */
  readonly writePractice: (
    writingSample: string
  ) => Promise<PracticeWritingResult>;
}

/**
 * A failed Academy request: its status, its code, and the message the server wrote for the
 * Learner. The Academy's routes answer fixed messages, never text a Learner wrote, and Grifando's
 * screens show them.
 */
export class AcademyRequestError extends Error {
  readonly code: string | undefined;
  readonly serverMessage: string | undefined;
  readonly status: number;

  constructor(
    status: number,
    failure: { readonly code?: string; readonly error?: string } = {}
  ) {
    super("Academy request could not be completed");
    this.name = "AcademyRequestError";
    this.code = failure.code;
    this.serverMessage = failure.error;
    this.status = status;
  }
}

// The statuses whose message a route writes for the Learner (Grifando's errorMessageFor).
const SHOWN_STATUSES = new Set([400, 401, 429, 503]);

/**
 * The message to show for a failed request, as Grifando's errorMessageFor chose it: a rate
 * limit's message, or a coded key failure's (`AI_…`); the caller's own message otherwise.
 */
export const messageFor = (error: unknown, fallback: string): string => {
  if (
    !(error instanceof AcademyRequestError) ||
    !SHOWN_STATUSES.has(error.status) ||
    error.serverMessage === undefined
  ) {
    return fallback;
  }
  if (error.status === 429) {
    return error.serverMessage;
  }
  return error.code?.startsWith("AI_") === true
    ? error.serverMessage
    : fallback;
};

// The codes of a server that found no key: none for the Trainer, or none for the hosted Judge
// (ADR 0035).
const KEY_REQUIRED_CODES = new Set([
  "AI_KEY_REQUIRED",
  "AI_JUDGE_KEY_REQUIRED",
]);

/**
 * Whether a failure asks the Learner to set up a key: the hosted browser holds none to send, or
 * the server found none (ADR 0034, ADR 0035).
 */
export const isKeyRequired = (error: unknown): boolean =>
  error instanceof MissingAIKeyError ||
  (error instanceof AcademyRequestError &&
    error.code !== undefined &&
    KEY_REQUIRED_CODES.has(error.code));

/**
 * What a screen shows for a failed Academy request: Grifando's key notice when the Trainer has no
 * key, otherwise the route's message or the screen's own fallback.
 */
export const failureNotice = (
  error: unknown,
  fallback: string
): { readonly keyRequired: true } | { readonly errorMessage: string } =>
  isKeyRequired(error)
    ? { keyRequired: true }
    : { errorMessage: messageFor(error, fallback) };

const unavailable = () =>
  Promise.reject(new Error("The Academy client is not available"));

/**
 * The client of a router built without one, as the Evaluation screen tests build it: every call
 * fails, so an Academy screen never shows data that did not come from a client.
 */
export const unavailableAcademyClient: AcademyClient = {
  answerInterviewTurn: unavailable,
  createVocabularyItem: unavailable,
  deleteLearner: unavailable,
  deleteVocabularyItem: unavailable,
  endInterview: unavailable,
  explainAttempt: unavailable,
  generateExercises: unavailable,
  getAcademyDashboard: unavailable,
  getDailyChallenge: unavailable,
  getMistakeNotebook: unavailable,
  getSampleLimits: unavailable,
  listPendingExercises: unavailable,
  listVocabulary: unavailable,
  startInterview: unavailable,
  submitAttempt: unavailable,
  testAIKey: unavailable,
  writePractice: unavailable,
};
