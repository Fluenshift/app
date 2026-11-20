// A fake Academy client for the screen tests: it answers from explicit fixtures, keeps the
// vocabulary it is given and saves, and records each save, generation and Attempt request. A call
// with no fixture fails.
import type {
  AcademyDashboard,
  DailyChallenge,
  ExerciseGenerationRequest,
  GradedAttempt,
  InterviewAnswerResult,
  MistakeNotebook,
  PendingExercise,
  PracticeWritingResult,
  StartedInterview,
  VocabularyItem,
  VocabularyItemRequest,
} from "@fluenshift/contract";

import {
  AcademyRequestError,
  unavailableAcademyClient,
} from "./academy-client";
import type { AcademyClient } from "./academy-client";

interface InMemoryExercises {
  /** The Trainer's explanation, or the failure of the explanation request. */
  readonly explanation?: string | AcademyRequestError;
  /** The set a generation creates, or the failure of the generation request. */
  readonly generated?: readonly PendingExercise[] | AcademyRequestError;
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
  readonly exercises?: InMemoryExercises;
  /** Every save fails, as a refused or failed request does. */
  readonly failVocabularySaves?: boolean;
  readonly interview?: InMemoryInterview;
  readonly mistakeNotebook?: MistakeNotebook;
  /** What practice writing answers, or the failure of its request. */
  readonly practiceWriting?: PracticeWritingResult | AcademyRequestError;
  /** The Learner's vocabulary, newest first. */
  readonly vocabulary?: readonly VocabularyItem[];
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
  readonly generationRequests: readonly ExerciseGenerationRequest[];
  readonly vocabularyRequests: readonly VocabularyItemRequest[];
  readonly writeRequests: readonly string[];
};

const settle = <A>(fixture: A | AcademyRequestError | undefined) => {
  if (fixture === undefined) {
    return Promise.reject(new AcademyRequestError(500));
  }
  return fixture instanceof AcademyRequestError
    ? Promise.reject(fixture)
    : Promise.resolve(fixture);
};

export const createInMemoryAcademyClient = ({
  academyDashboard,
  dailyChallenge,
  exercises = {},
  failVocabularySaves = false,
  interview = {},
  mistakeNotebook,
  practiceWriting,
  vocabulary,
}: InMemoryAcademyClientOptions = {}): InMemoryAcademyClient => {
  let items = vocabulary;
  const vocabularyRequests: VocabularyItemRequest[] = [];
  const generationRequests: ExerciseGenerationRequest[] = [];
  const attemptRequests: { answer: string; exerciseId: string }[] = [];
  const writeRequests: string[] = [];
  const answerRequests: {
    answer: string;
    sessionId: string;
    turnId: string;
  }[] = [];
  const endRequests: string[] = [];

  return {
    answerInterviewTurn: (sessionId, turnId, answer) => {
      answerRequests.push({ answer, sessionId, turnId });
      return settle(interview.answers?.[answerRequests.length - 1]);
    },
    answerRequests,
    attemptRequests,
    createVocabularyItem: (request) => {
      vocabularyRequests.push(request);
      if (failVocabularySaves || items === undefined) {
        return Promise.reject(new Error("The save failed"));
      }
      items = [
        {
          createdAt: new Date().toISOString(),
          exampleSentence: request.exampleSentence,
          id: `item-${vocabularyRequests.length}`,
          meaningPt: request.meaningPt,
          sourceEvaluationId: request.sourceEvaluationId ?? null,
          term: request.term,
        },
        ...items,
      ];
      return Promise.resolve();
    },
    deleteVocabularyItem: (itemId) => {
      if (items === undefined) {
        return unavailableAcademyClient.deleteVocabularyItem(itemId);
      }
      items = items.filter((item) => item.id !== itemId);
      return Promise.resolve();
    },
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
    listPendingExercises: () => settle(exercises.pending),
    listVocabulary: () =>
      items === undefined
        ? unavailableAcademyClient.listVocabulary()
        : Promise.resolve(items),
    startInterview: () => settle(interview.started),
    submitAttempt: (exerciseId, answer) => {
      attemptRequests.push({ answer, exerciseId });
      return settle(exercises.graded?.[exerciseId]);
    },
    vocabularyRequests,
    writePractice: (writingSample) => {
      writeRequests.push(writingSample);
      return settle(practiceWriting);
    },
    writeRequests,
  };
};
