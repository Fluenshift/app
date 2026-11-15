// Ported from Grifando src/server/domain/vocabulary/vocabulary.repository.test.ts (74dbb9f): each
// case runs on a fresh PGlite database. A source is one of the Learner's Evaluations, which
// replace Grifando's writing sessions (docs/adr/0004).
import { rm } from "node:fs/promises";

import { LearnerId } from "@fluenshift/contract";
import { Effect, Schema } from "effect";
import type { Layer } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { persistEvaluation } from "../history/learning-history";
import { CurrentLearner } from "../learner-identity";
import { makeTemporaryDatabase } from "../test/database";
import {
  createVocabularyItem,
  deleteVocabularyItem,
  listVocabularyItems,
} from "./vocabulary-repository";

let database: Awaited<ReturnType<typeof makeTemporaryDatabase>>;

const run = <A, E>(
  effect: Effect.Effect<A, E, Layer.Success<typeof database.layer>>
) => Effect.runPromise(effect.pipe(Effect.provide(database.layer)));

// The other Learner of these cases; the local Learner is the one the database layer names.
const asOtherLearner = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.provideService(
      CurrentLearner,
      CurrentLearner.of({ id: Schema.decodeSync(LearnerId)("other-user") })
    )
  );

const evaluationWithId = (id: string) => ({
  contentHash: "content-hash",
  evaluation: {
    band: "Natural" as const,
    correctedText: "text",
    evaluatedAt: "2026-09-07T12:00:00.000Z",
    evaluatedEnglishWordCount: 1,
    findings: [],
    id,
    model: "deterministic-test-model",
    originalText: "text",
    provider: "test",
    rubricVersion: "1",
    score: 100,
    suggestions: [],
    summary: "No errors found.",
  },
  latencyMilliseconds: 20,
  submittedAt: "2026-09-07T11:59:59.000Z",
});

beforeEach(async () => {
  database = await makeTemporaryDatabase();
});

afterEach(async () => {
  await rm(database.directory, { force: true, recursive: true });
});

const item = {
  exampleSentence: "You can rely on the cache.",
  meaningPt: "contar com",
  term: "rely on",
};

describe("vocabularyRepository", () => {
  it("creates, lists newest first, and deletes the user's items", async () => {
    const first = await run(createVocabularyItem(item));
    const second = await run(
      createVocabularyItem({ ...item, term: "figure out" })
    );

    const listed = await run(listVocabularyItems());
    expect(listed.map((i) => i.id)).toEqual([second.id, first.id]);

    expect(await run(deleteVocabularyItem(first.id))).toBe(true);
    expect(await run(listVocabularyItems())).toHaveLength(1);
  });

  it("keeps a source session only when it belongs to the user", async () => {
    await run(persistEvaluation(evaluationWithId("own")));
    await run(asOtherLearner(persistEvaluation(evaluationWithId("foreign"))));

    const linked = await run(
      createVocabularyItem({ ...item, sourceEvaluationId: "own" })
    );
    const unlinked = await run(
      createVocabularyItem({ ...item, sourceEvaluationId: "foreign" })
    );

    expect(linked.sourceEvaluationId).toBe("own");
    expect(unlinked.sourceEvaluationId).toBeNull();
  });

  it("refuses to delete another user's item", async () => {
    const theirs = await run(asOtherLearner(createVocabularyItem(item)));

    expect(await run(deleteVocabularyItem(theirs.id))).toBe(false);
    expect(await run(asOtherLearner(listVocabularyItems()))).toHaveLength(1);
  });
});
