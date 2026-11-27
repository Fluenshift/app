// A fake Academy client for the screen tests: it answers from explicit fixtures, and records each
// generation, Attempt, key test and Learner deletion request. A call with no fixture fails.
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
} from "@grifando/contract";

import { getStoredAIKey, MissingAIKeyError } from "../settings/ai-key-store";
import type { AICredentials } from "../settings/ai-key-store";
import {
  AcademyRequestError,
  unavailableAcademyClient,
} from "./academy-client";
import type { AcademyClient } from "./academy-client";

interface InMemoryExercises {
  /** The Trainer's explanation, or the failure of the explanation request. */
  readonly explanation?: string | AcademyRequestError;
  /**
   * The set a generation creates, or the failure of the generation request: the server's, or
   * the hosted browser's missing key.
   */
  readonly generated?:
    | readonly PendingExercise[]
    | AcademyRequestError
    | MissingAIKeyError;
  /** The grade of an answer to each Exercise, by its id. */
  readonly graded?: Readonly<Record<string, GradedAttempt>>;
  readonly pending?: readonly PendingExercise[];
}

interface InMemoryInterview {
  /** What each answer answers, in order, or the failure of its request. */
  readonly answers?: readonly (InterviewAnswerResult | AcademyRequestError)[];
  /** The new interview, or the failure of the start request. */
  readonly started?: StartedInterview | AcademyRequestError;
}

interface InMemoryAcademyClientOptions {
  readonly academyDashboard?: AcademyDashboard;
  readonly dailyChallenge?: DailyChallenge;
  /**
   * What each deletion of the Learner does, in order: `null` deletes, a promise is a deletion
   * still running, an error is its failure.
   */
  readonly deletions?: readonly (null | Promise<undefined> | Error)[];
  readonly exercises?: InMemoryExercises;
  readonly interview?: InMemoryInterview;
  /** What each key test finds, in order: a status, a test still running, or its failure. */
  readonly keyTests?: readonly (
    | KeyTestStatus
    | Promise<KeyTestStatus>
    | AcademyRequestError
  )[];
  readonly mistakeNotebook?: MistakeNotebook;
  /** What practice writing answers, or the failure of its request. */
  readonly practiceWriting?: PracticeWritingResult | AcademyRequestError;
  /** The Deploy Profile's caps; the local profile's when left out (ADR 0006). */
  readonly sampleLimits?: SampleLimits;
}

export type InMemoryAcademyClient = AcademyClient & {
  readonly answerRequests: readonly {
    readonly answer: string;
    readonly sessionId: string;
    readonly turnId: string;
  }[];
  readonly endRequests: readonly string[];
  readonly attemptRequests: readonly {
    readonly answer: string;
    readonly exerciseId: string;
  }[];
  /** The key the browser held when each deletion ran: the page clears it only after one. */
  readonly deletionRequests: readonly (AICredentials | null)[];
  readonly generationRequests: readonly ExerciseGenerationRequest[];
  /** The key the browser held when each key test ran, as the hosted client would send it. */
  readonly keyTestRequests: readonly (AICredentials | null)[];
  readonly writeRequests: readonly string[];
  /** The snippet each practice writing request sent, beside its Writing Sample. */
  readonly codeSnippets: readonly (string | undefined)[];
};

const settle = <A>(
  fixture: A | AcademyRequestError | MissingAIKeyError | undefined
) => {
  if (fixture === undefined) {
    return Promise.reject(new AcademyRequestError(500));
  }
  return fixture instanceof AcademyRequestError ||
    fixture instanceof MissingAIKeyError
    ? Promise.reject(fixture)
    : Promise.resolve(fixture);
};

// A deletion's fixture as its answer; with none, the request fails.
const deletionOf = (
  deletion: null | Promise<undefined> | Error | undefined
): Promise<undefined> => {
  if (deletion === null) {
    return Promise.resolve(undefined);
  }
  if (deletion instanceof Promise) {
    return deletion;
  }
  return Promise.reject(deletion ?? new AcademyRequestError(500));
};

export const createInMemoryAcademyClient = ({
  academyDashboard,
  dailyChallenge,
  deletions = [],
  exercises = {},
  interview = {},
  keyTests = [],
  mistakeNotebook,
  practiceWriting,
  sampleLimits = {
    codeMaxCharacters: null,
    sampleMaxBytes: 32_768,
    sampleMaxCharacters: null,
  },
}: InMemoryAcademyClientOptions = {}): InMemoryAcademyClient => {
  const generationRequests: ExerciseGenerationRequest[] = [];
  const attemptRequests: { answer: string; exerciseId: string }[] = [];
  const writeRequests: string[] = [];
  const codeSnippets: (string | undefined)[] = [];
  const answerRequests: {
    answer: string;
    sessionId: string;
    turnId: string;
  }[] = [];
  const endRequests: string[] = [];
  const keyTestRequests: (AICredentials | null)[] = [];
  const deletionRequests: (AICredentials | null)[] = [];

  return {
    answerInterviewTurn: (sessionId, turnId, answer) => {
      answerRequests.push({ answer, sessionId, turnId });
      return settle(interview.answers?.[answerRequests.length - 1]);
    },
    answerRequests,
    attemptRequests,
    codeSnippets,
    deleteLearner: async () => {
      deletionRequests.push(getStoredAIKey());
      await deletionOf(deletions[deletionRequests.length - 1]);
    },
    deletionRequests,
    endInterview: (sessionId) => {
      endRequests.push(sessionId);
      return Promise.resolve();
    },
    endRequests,
    explainAttempt: () => settle(exercises.explanation),
    generateExercises: (request) => {
      generationRequests.push(request);
      return settle(exercises.generated);
    },
    generationRequests,
    getAcademyDashboard: () =>
      academyDashboard === undefined
        ? unavailableAcademyClient.getAcademyDashboard()
        : Promise.resolve(academyDashboard),
    getDailyChallenge: () =>
      dailyChallenge === undefined
        ? unavailableAcademyClient.getDailyChallenge()
        : Promise.resolve(dailyChallenge),
    getMistakeNotebook: () =>
      mistakeNotebook === undefined
        ? unavailableAcademyClient.getMistakeNotebook()
        : Promise.resolve(mistakeNotebook),
    getSampleLimits: () => Promise.resolve(sampleLimits),
    keyTestRequests,
    listPendingExercises: () => settle(exercises.pending),
    startInterview: () => settle(interview.started),
    submitAttempt: (exerciseId, answer) => {
      attemptRequests.push({ answer, exerciseId });
      return settle(exercises.graded?.[exerciseId]);
    },
    testAIKey: () => {
      keyTestRequests.push(getStoredAIKey());
      const keyTest = keyTests[keyTestRequests.length - 1];
      return keyTest instanceof Promise ? keyTest : settle(keyTest);
    },
    writePractice: (writingSample, codeSnippet) => {
      writeRequests.push(writingSample);
      codeSnippets.push(codeSnippet);
      return settle(practiceWriting);
    },
    writeRequests,
  };
};
