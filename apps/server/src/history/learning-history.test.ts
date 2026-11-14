import { rm } from "node:fs/promises";

import { LearnerId } from "@fluenshift/contract";
import { Database } from "@fluenshift/db";
import { sql } from "drizzle-orm";
import { Effect, Layer, Schema } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import { CurrentLearner } from "../learner-identity";
import { makeTemporaryDatabase } from "../test/database";
import {
  deleteEvaluation,
  getEvaluation,
  listEvaluations,
  persistEvaluation,
} from "./learning-history";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
});

const sample = (id: string, originalText = "Command fail.") => ({
  contentHash: "same-content-hash",
  evaluation: {
    band: "Natural" as const,
    correctedText: "Command fails.",
    evaluatedAt: "2026-09-07T12:00:00.000Z",
    evaluatedEnglishWordCount: 2,
    findings: [
      {
        byteEnd: 12,
        byteStart: 8,
        category: "Verb form/tense" as const,
        correction: "fails",
        explanation: "A singular subject needs a singular verb.",
        originalText: "fail",
        severity: "Minor" as const,
      },
    ],
    id,
    model: "deterministic-test-model",
    originalText,
    provider: "test",
    rubricVersion: "1",
    score: 85,
    suggestions: [
      {
        alternative: "Run the command.",
        byteEnd: 7,
        byteStart: 0,
        explanation: "Choice depends on intended tone.",
        originalText: "Command",
      },
    ],
    summary: "One local agreement error.",
  },
  inputTokens: 10,
  latencyMilliseconds: 20,
  outputTokens: 30,
  submittedAt: "2026-09-07T11:59:59.000Z",
});

describe("Learning History", () => {
  it("retains immutable complete Evaluations newest first", async () => {
    const database = await makeTemporaryDatabase();
    directories.push(database.directory);

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* persistEvaluation(sample("first"));
        yield* persistEvaluation(sample("second"));
        return {
          detail: yield* getEvaluation("first"),
          summaries: yield* listEvaluations(),
        };
      }).pipe(Effect.provide(database.layer))
    );

    expect(result.summaries.map(({ id }) => id)).toEqual(["second", "first"]);
    expect(result.detail).toEqual(sample("first").evaluation);
  });

  it("deletes one whole Evaluation while preserving other evidence", async () => {
    const database = await makeTemporaryDatabase();
    directories.push(database.directory);

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* persistEvaluation(sample("keep"));
        yield* persistEvaluation(sample("delete", "Repeated sample."));
        yield* deleteEvaluation("delete");
        return {
          deleted: yield* getEvaluation("delete"),
          kept: yield* getEvaluation("keep"),
          summaries: yield* listEvaluations(),
        };
      }).pipe(Effect.provide(database.layer))
    );

    expect(result.deleted).toBeNull();
    expect(result.kept?.id).toBe("keep");
    expect(result.summaries.map(({ id }) => id)).toEqual(["keep"]);
  });

  it("reopens complete retained evidence after the database service is replaced", async () => {
    const database = await makeTemporaryDatabase();
    directories.push(database.directory);

    await Effect.runPromise(
      persistEvaluation(sample("durable")).pipe(Effect.provide(database.layer))
    );
    const reopened = await Effect.runPromise(
      getEvaluation("durable").pipe(Effect.provide(database.layer))
    );

    expect(reopened).toEqual(sample("durable").evaluation);
  });

  it("rolls back the parent row when a child insert fails", async () => {
    const database = await makeTemporaryDatabase();
    directories.push(database.directory);
    const invalid = sample("partial");
    const [finding] = invalid.evaluation.findings;
    if (finding === undefined) {
      throw new Error("Expected fixture Finding");
    }
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const outcome = yield* Effect.exit(
          persistEvaluation({
            ...invalid,
            evaluation: {
              ...invalid.evaluation,
              findings: [
                {
                  ...finding,
                  explanation: null as never,
                },
              ],
            },
          })
        );
        const retained = yield* getEvaluation("partial");
        return { outcome, retained };
      }).pipe(Effect.provide(database.layer))
    );

    expect(result.outcome._tag).toBe("Failure");
    expect(result.retained).toBeNull();
  });
});

// A Learner other than the local one, as the hosted profile will have many (docs/adr/0003).
const asLearner = (id: string) =>
  Layer.succeed(
    CurrentLearner,
    CurrentLearner.of({ id: Schema.decodeSync(LearnerId)(id) })
  );

describe("Learning History scope", () => {
  it("keeps each Learner's History apart", async () => {
    const database = await makeTemporaryDatabase();
    directories.push(database.directory);

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* persistEvaluation(sample("mine"));
        yield* persistEvaluation(sample("theirs")).pipe(
          Effect.provide(asLearner("someone-else"))
        );
        yield* deleteEvaluation("theirs");
        return {
          mine: yield* listEvaluations(),
          seen: yield* getEvaluation("theirs"),
          theirs: yield* listEvaluations().pipe(
            Effect.provide(asLearner("someone-else"))
          ),
        };
      }).pipe(Effect.provide(database.layer))
    );

    expect(result.mine.map(({ id }) => id)).toStrictEqual(["mine"]);
    expect(result.seen).toBeNull();
    expect(result.theirs.map(({ id }) => id)).toStrictEqual(["theirs"]);
  });

  it("stores the origin of each Writing Sample, work unless given", async () => {
    const database = await makeTemporaryDatabase();
    directories.push(database.directory);

    const origins = await Effect.runPromise(
      Effect.gen(function* () {
        yield* persistEvaluation(sample("real"));
        yield* persistEvaluation({ ...sample("exercise"), origin: "practice" });
        const db = yield* Database;
        const rows = yield* db.run((client) =>
          client.execute(sql`select id, origin from evaluations order by id`)
        );
        return rows.rows;
      }).pipe(Effect.provide(database.layer))
    );

    expect(origins).toStrictEqual([
      { id: "exercise", origin: "practice" },
      { id: "real", origin: "work" },
    ]);
  });
});

// A sample Evaluation completed at a given moment.
const at = (id: string, evaluatedAt: string) => ({
  ...sample(id),
  evaluation: { ...sample(id).evaluation, evaluatedAt },
});

describe("Learning History order", () => {
  it("lists newer moments first and one moment's Evaluations by their insertion, newest first", async () => {
    const database = await makeTemporaryDatabase();
    directories.push(database.directory);

    const summaries = await Effect.runPromise(
      Effect.gen(function* () {
        yield* persistEvaluation(at("noon-1", "2026-09-07T12:00:00.000Z"));
        yield* persistEvaluation(at("evening", "2026-09-07T18:00:00.000Z"));
        yield* persistEvaluation(at("noon-2", "2026-09-07T12:00:00.000Z"));
        yield* persistEvaluation(at("morning", "2026-09-07T08:00:00.000Z"));
        yield* persistEvaluation(at("noon-3", "2026-09-07T12:00:00.000Z"));
        yield* persistEvaluation(at("noon-4", "2026-09-07T12:00:00.000Z"));
        return yield* listEvaluations();
      }).pipe(Effect.provide(database.layer))
    );

    expect(summaries.map(({ id }) => id)).toStrictEqual([
      "evening",
      "noon-4",
      "noon-3",
      "noon-2",
      "noon-1",
      "morning",
    ]);
  });

  it("returns Findings and Suggestions in the order they were stored", async () => {
    const database = await makeTemporaryDatabase();
    directories.push(database.directory);
    const base = sample("ordered", "Command fail. Run fail.");
    const [finding] = base.evaluation.findings;
    const [suggestion] = base.evaluation.suggestions;
    if (finding === undefined || suggestion === undefined) {
      throw new Error("Expected fixture Finding and Suggestion");
    }
    const ordered = {
      ...base,
      evaluation: {
        ...base.evaluation,
        findings: [
          finding,
          {
            ...finding,
            byteEnd: 22,
            byteStart: 18,
            explanation: "The second agreement error.",
          },
        ],
        suggestions: [
          suggestion,
          {
            ...suggestion,
            alternative: "Start",
            byteEnd: 17,
            byteStart: 14,
            originalText: "Run",
          },
        ],
      },
    };

    const reopened = await Effect.runPromise(
      Effect.gen(function* () {
        yield* persistEvaluation(ordered);
        return yield* getEvaluation("ordered");
      }).pipe(Effect.provide(database.layer))
    );

    expect(reopened).toStrictEqual(ordered.evaluation);
  });
});
