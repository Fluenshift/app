import { Effect } from "effect";

export interface VocabularyItem {
  readonly createdAt: Date;
  readonly exampleSentence: string;
  readonly id: string;
  readonly meaningPt: string;
  readonly sourceEvaluationId: string | null;
  readonly term: string;
}

export interface CreateVocabularyItemInput {
  readonly exampleSentence: string;
  readonly meaningPt: string;
  readonly sourceEvaluationId?: string;
  readonly term: string;
}

const PLACEHOLDER: VocabularyItem = {
  createdAt: new Date(0),
  exampleSentence: "",
  id: "",
  meaningPt: "",
  sourceEvaluationId: "placeholder",
  term: "",
};

export const createVocabularyItem = Effect.fn(
  "VocabularyRepository.createVocabularyItem"
)(function* (_input: CreateVocabularyItemInput) {
  return yield* Effect.succeed(PLACEHOLDER);
});

export const listVocabularyItems = Effect.fn(
  "VocabularyRepository.listVocabularyItems"
)(function* () {
  return yield* Effect.succeed<readonly VocabularyItem[]>([]);
});

export const deleteVocabularyItem = Effect.fn(
  "VocabularyRepository.deleteVocabularyItem"
)(function* (_id: string) {
  return yield* Effect.succeed(true);
});
