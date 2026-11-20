// A fake Academy client for the screen tests: it answers from explicit fixtures, keeps the
// vocabulary it is given and saves, and records each save request. A read with no fixture fails.
import type {
  DailyChallenge,
  VocabularyItem,
  VocabularyItemRequest,
} from "@fluenshift/contract";

import { unavailableAcademyClient } from "./academy-client";
import type { AcademyClient } from "./academy-client";

interface InMemoryAcademyClientOptions {
  readonly dailyChallenge?: DailyChallenge;
  /** Every save fails, as a refused or failed request does. */
  readonly failVocabularySaves?: boolean;
  /** The Learner's vocabulary, newest first. */
  readonly vocabulary?: readonly VocabularyItem[];
}

export type InMemoryAcademyClient = AcademyClient & {
  readonly vocabularyRequests: readonly VocabularyItemRequest[];
};

export const createInMemoryAcademyClient = ({
  dailyChallenge,
  failVocabularySaves = false,
  vocabulary,
}: InMemoryAcademyClientOptions = {}): InMemoryAcademyClient => {
  let items = vocabulary;
  const vocabularyRequests: VocabularyItemRequest[] = [];

  return {
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
    getDailyChallenge: () =>
      dailyChallenge === undefined
        ? unavailableAcademyClient.getDailyChallenge()
        : Promise.resolve(dailyChallenge),
    listVocabulary: () =>
      items === undefined
        ? unavailableAcademyClient.listVocabulary()
        : Promise.resolve(items),
    vocabularyRequests,
  };
};
