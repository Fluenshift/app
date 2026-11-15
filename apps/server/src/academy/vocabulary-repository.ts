// The Learner's saved vocabulary. Ported from Grifando
// src/server/domain/vocabulary/vocabulary.repository.ts (74dbb9f). A source that is not one of the
// Learner's own Evaluations is dropped rather than trusted: the link is a convenience, never an
// authorization. Evaluations replace Grifando's writing sessions (docs/adr/0004).
import { randomUUID } from "node:crypto";

import {
  Database,
  evaluations,
  learners,
  vocabularyItems,
} from "@fluenshift/db";
import { and, desc, eq } from "drizzle-orm";
import { Effect } from "effect";

import { CurrentLearner } from "../learner-identity";

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

const toItem = (row: typeof vocabularyItems.$inferSelect): VocabularyItem => ({
  createdAt: row.createdAt,
  exampleSentence: row.exampleSentence,
  id: row.id,
  meaningPt: row.meaningPt,
  sourceEvaluationId: row.sourceEvaluationId,
  term: row.term,
});

export const createVocabularyItem = Effect.fn(
  "VocabularyRepository.createVocabularyItem"
)(function* ({ sourceEvaluationId, ...item }: CreateVocabularyItemInput) {
  const database = yield* Database;
  const learner = yield* CurrentLearner;
  const rows = yield* database.run((client) =>
    client.transaction((transaction) =>
      transaction
        .insert(learners)
        .values({ id: learner.id })
        .onConflictDoNothing()
        .then(() =>
          sourceEvaluationId === undefined
            ? []
            : transaction
                .select({ id: evaluations.id })
                .from(evaluations)
                .where(
                  and(
                    eq(evaluations.id, sourceEvaluationId),
                    eq(evaluations.learnerId, learner.id)
                  )
                )
        )
        .then((owned) =>
          transaction
            .insert(vocabularyItems)
            .values({
              ...item,
              id: randomUUID(),
              learnerId: learner.id,
              sourceEvaluationId: owned.length > 0 ? sourceEvaluationId : null,
            })
            .returning()
        )
    )
  );
  const [row] = rows;
  if (row === undefined) {
    return yield* Effect.die(new Error("The insert returned no item"));
  }
  return toItem(row);
});

// The Learner's items, newest first.
export const listVocabularyItems = Effect.fn(
  "VocabularyRepository.listVocabularyItems"
)(function* () {
  const database = yield* Database;
  const learner = yield* CurrentLearner;
  const rows = yield* database.run((client) =>
    client
      .select()
      .from(vocabularyItems)
      .where(eq(vocabularyItems.learnerId, learner.id))
      .orderBy(
        desc(vocabularyItems.createdAt),
        desc(vocabularyItems.insertionOrder)
      )
  );
  return rows.map(toItem);
});

// False when the item does not exist or belongs to another Learner.
export const deleteVocabularyItem = Effect.fn(
  "VocabularyRepository.deleteVocabularyItem"
)(function* (id: string) {
  const database = yield* Database;
  const learner = yield* CurrentLearner;
  const deleted = yield* database.run((client) =>
    client
      .delete(vocabularyItems)
      .where(
        and(
          eq(vocabularyItems.id, id),
          eq(vocabularyItems.learnerId, learner.id)
        )
      )
      .returning({ id: vocabularyItems.id })
  );
  return deleted.length === 1;
});
