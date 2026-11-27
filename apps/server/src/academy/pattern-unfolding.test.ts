// Deleting an Evaluation removes the Academy state built from it (docs/adr/0031, DATA-POLICY.md §
// Deletion): each Mistake Pattern it touched is rebuilt from the Occurrences and the Attempts that
// remain, and a pattern left without an Occurrence goes, while the Learner's Exercises and
// Attempts stay. Each case runs on fresh PGlite databases with the clock fixed, so a history
// played again without the deleted Evaluation leaves rows that compare exactly.
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";

import { MistakeCategory } from "@grifando/contract";
import type { ErrorCategory, LearnerId } from "@grifando/contract";
import {
  Database,
  enrichments,
  evaluations,
  exerciseAttempts,
  exercises,
  learners,
  mistakePatterns,
  occurrences,
} from "@grifando/db";
import type { DrizzleClient } from "@grifando/db";
import { asc, eq } from "drizzle-orm";
import { Effect } from "effect";
import type { Layer } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteEvaluation,
  persistEvaluation,
} from "../history/learning-history";
import type {
  Evaluation,
  EvaluationFinding,
} from "../history/learning-history";
import { CurrentLearner, LOCAL_LEARNER_ID } from "../learner-identity";
import { makeTemporaryDatabase } from "../test/database";
import { submitAttempt } from "./exercise-service";
import { foldEvaluation } from "./pattern-folding";
import type {
  FindingEnrichment,
  NaturalnessNote,
  TrainerMethods,
} from "./trainer/trainer-model";

type Services = Layer.Success<
  Awaited<ReturnType<typeof makeTemporaryDatabase>>["layer"]
>;

const directories: string[] = [];

beforeEach(() => {
  vi.useFakeTimers({
    now: new Date("2026-11-20T09:00:00.000Z"),
    toFake: ["Date"],
  });
});

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
});

const only = <Row>(rows: readonly Row[]): Row => {
  const [row] = rows;
  if (row === undefined) {
    throw new Error("Expected one row");
  }
  return row;
};

// A fresh database, with the means to act on it for the local Learner.
const openDatabase = async () => {
  const database = await makeTemporaryDatabase();
  directories.push(database.directory);
  const run = <A, E>(effect: Effect.Effect<A, E, Services>) =>
    Effect.runPromise(effect.pipe(Effect.provide(database.layer)));
  const query = <A>(read: (client: DrizzleClient) => Promise<A>) =>
    run(
      Effect.gen(function* () {
        const service = yield* Database;
        return yield* service.run(read);
      })
    );
  return { query, run };
};

type Session = Awaited<ReturnType<typeof openDatabase>>;

// Moves the fixed clock to a moment of 2026-11-20.
const at = (time: string) => {
  vi.setSystemTime(new Date(`2026-11-20T${time}:00.000Z`));
};

interface FixtureFinding {
  readonly category: ErrorCategory;
  readonly correction: string;
  readonly originalText: string;
}

// Stores, now, a practice Evaluation of `writingSample` with these Findings, located in order. The
// samples are ASCII, so a span's byte offsets are its character offsets.
const storeEvaluation = (
  session: Session,
  writingSample: string,
  fixtureFindings: readonly FixtureFinding[]
) => {
  const findings: EvaluationFinding[] = [];
  let from = 0;
  for (const finding of fixtureFindings) {
    const byteStart = writingSample.indexOf(finding.originalText, from);
    from = byteStart + finding.originalText.length;
    findings.push({
      ...finding,
      byteEnd: from,
      byteStart,
      explanation: "Characterized.",
      severity: "Moderate",
    });
  }
  const evaluation: Evaluation = {
    band: "Understandable",
    correctedText: writingSample,
    evaluatedAt: new Date().toISOString(),
    evaluatedEnglishWordCount: 10,
    findings,
    id: randomUUID(),
    model: "judge-model",
    originalText: writingSample,
    provider: "openrouter",
    rubricVersion: "1",
    score: 70,
    suggestions: [],
    summary: "Characterized.",
  };
  return session
    .run(
      persistEvaluation({
        contentHash: "hash",
        evaluation,
        latencyMilliseconds: 1,
        origin: "practice",
        submittedAt: evaluation.evaluatedAt,
      })
    )
    .then(() => evaluation);
};

const unasked = () => Effect.die(new Error("The case asks no such call"));

// A Trainer whose Enrichment answers these Academy fields and these Naturalness Notes.
const trainerAnswering = (
  findings: readonly FindingEnrichment[],
  naturalnessNotes: readonly NaturalnessNote[]
): TrainerMethods => ({
  continueInterview: unasked,
  enrichFindings: () =>
    Effect.succeed({
      findings,
      model: "test-model",
      naturalVersion: "A natural version.",
      naturalnessNotes,
    }),
  explainAttempt: unasked,
  generateExercises: unasked,
});

const dependOn = (example: string): FindingEnrichment => ({
  category: MistakeCategory.PREPOSITIONS,
  example,
  l1Transfer: false,
  patternKey: "preposition:depend",
});

const makeNote = (
  originalSpan: string,
  naturalSpan: string
): NaturalnessNote => ({
  example: "We hold a meeting every Monday.",
  explanation: "English uses another verb here.",
  l1Transfer: true,
  naturalSpan,
  originalSpan,
  patternKey: "collocation:make",
});

// The first Evaluation: two preposition Findings of one pattern and two unnatural-phrasing notes
// of another, each with its own spans, so the example tells which Occurrence was folded last. Their
// spans sort against their order, so no other order passes for it.
const foldFirst = async (session: Session) => {
  const evaluation = await storeEvaluation(
    session,
    "It depends of you and I depend of it, so we make a meeting and make a decision.",
    [
      {
        category: "Preposition",
        correction: "depends on",
        originalText: "depends of",
      },
      {
        category: "Preposition",
        correction: "depend on",
        originalText: "depend of",
      },
    ]
  );
  await session.run(
    foldEvaluation(
      trainerAnswering(
        [dependOn("It depends on the cache."), dependOn("I depend on you.")],
        [
          makeNote("make a meeting", "hold a meeting"),
          makeNote("make a decision", "take a decision"),
        ]
      ),
      { evaluationId: evaluation.id }
    )
  );
  return evaluation;
};

// The second Evaluation: the same preposition pattern, a spelling Finding of its own pattern, and
// the same note's pattern.
const foldSecond = async (session: Session) => {
  const evaluation = await storeEvaluation(
    session,
    "It depended of teh cache, so we make a plan.",
    [
      {
        category: "Preposition",
        correction: "depended on",
        originalText: "depended of",
      },
      { category: "Spelling", correction: "the", originalText: "teh" },
    ]
  );
  await session.run(
    foldEvaluation(
      trainerAnswering(
        [
          dependOn("It depends on the API."),
          {
            category: MistakeCategory.SPELLING,
            example: "Read the docs.",
            l1Transfer: false,
            patternKey: "spelling:the",
          },
        ],
        [makeNote("make a plan", "draw up a plan")]
      ),
      { evaluationId: evaluation.id }
    )
  );
  return evaluation;
};

const patternIdOf = (session: Session, category: MistakeCategory) =>
  session
    .query((client) =>
      client
        .select({ id: mistakePatterns.id })
        .from(mistakePatterns)
        .where(eq(mistakePatterns.category, category))
    )
    .then((rows) => only(rows).id);

// One Attempt on a new multiple-choice Exercise for the pattern, right or wrong.
const answer = async (
  session: Session,
  patternId: string,
  isCorrect: boolean
) => {
  const exercise = await session
    .query((client) =>
      client
        .insert(exercises)
        .values({
          id: randomUUID(),
          learnerId: LOCAL_LEARNER_ID,
          model: "test-model",
          promptData: {
            correctOptionIndex: 1,
            explanation: "The rule.",
            instruction: "Choose the natural sentence.",
            options: ["The wrong one.", "The right one."],
            type: "MULTIPLE_CHOICE",
          },
          sourcePatternId: patternId,
          type: "MULTIPLE_CHOICE",
        })
        .returning()
    )
    .then(only);
  await session.run(submitAttempt(exercise.id, isCorrect ? "1" : "0"));
};

// The Learner's patterns by Pattern Key, without their ids, which differ between databases.
const patternsOf = (session: Session) =>
  session
    .query((client) =>
      client
        .select()
        .from(mistakePatterns)
        .orderBy(asc(mistakePatterns.patternKey))
    )
    .then((rows) => rows.map(({ id: _id, ...pattern }) => pattern));

// The first Evaluation, then practice on both of its patterns, the second Evaluation when asked,
// more practice, and the second Evaluation's deletion. Answers the patterns this leaves.
const historyWith = async (withDeletedEvaluation: boolean) => {
  const session = await openDatabase();
  at("10:00");
  await foldFirst(session);
  const preposition = await patternIdOf(session, MistakeCategory.PREPOSITIONS);
  const phrasing = await patternIdOf(
    session,
    MistakeCategory.UNNATURAL_PHRASING
  );
  at("10:05");
  await answer(session, preposition, true);
  at("10:10");
  await answer(session, phrasing, false);
  at("10:15");
  await answer(session, preposition, true);
  at("10:20");
  const second = withDeletedEvaluation ? await foldSecond(session) : null;
  at("10:25");
  await answer(session, preposition, true);
  at("10:30");
  if (second !== null) {
    await session.run(deleteEvaluation(second.id));
  }
  return patternsOf(session);
};

describe("Deleting an Evaluation", () => {
  it("leaves each Mistake Pattern as it would be had the Evaluation never been folded", async () => {
    const neverFolded = await historyWith(false);
    const deleted = await historyWith(true);

    expect(
      neverFolded.map(({ category, masteryLevel, occurrenceCount }) => [
        category,
        masteryLevel,
        occurrenceCount,
      ])
    ).toStrictEqual([
      [MistakeCategory.UNNATURAL_PHRASING, "ACTIVE", 2],
      [MistakeCategory.PREPOSITIONS, "IMPROVING", 2],
    ]);
    expect(deleted).toStrictEqual(neverFolded);
  });

  it("rebuilds a pattern from its later Occurrences when the Evaluation that created it goes, and keeps the Attempts made before them", async () => {
    const session = await openDatabase();
    at("10:00");
    const first = await foldFirst(session);
    const preposition = await patternIdOf(
      session,
      MistakeCategory.PREPOSITIONS
    );
    at("10:05");
    await answer(session, preposition, true);
    at("10:10");
    await answer(session, preposition, true);
    at("10:20");
    await foldSecond(session);
    at("10:25");
    await answer(session, preposition, true);
    at("10:30");

    await session.run(deleteEvaluation(first.id));

    const secondFold = new Date("2026-11-20T10:20:00.000Z");
    const patterns = await patternsOf(session);
    expect(
      patterns.map(({ category, patternKey }) => [category, patternKey])
    ).toStrictEqual([
      [MistakeCategory.UNNATURAL_PHRASING, "collocation-make"],
      [MistakeCategory.PREPOSITIONS, "preposition-depend"],
      [MistakeCategory.SPELLING, "spelling-the"],
    ]);
    expect(patterns[0]).toMatchObject({
      exampleCorrection: "draw up a plan",
      exampleOriginal: "make a plan",
      firstSeenAt: secondFold,
      incorrectCount: 0,
      lastPracticedAt: secondFold,
      lastSeenAt: secondFold,
      occurrenceCount: 1,
    });
    // The three Attempts count, the two made before the pattern's only Occurrence too, and replay
    // with it in the order they happened: right, right, the Finding, right.
    expect(patterns[1]).toMatchObject({
      consecutiveCorrectCount: 1,
      correctCount: 3,
      exampleCorrection: "depended on",
      exampleOriginal: "depended of",
      firstSeenAt: secondFold,
      incorrectCount: 1,
      lastPracticedAt: new Date("2026-11-20T10:25:00.000Z"),
      lastSeenAt: secondFold,
      masteryLevel: "ACTIVE",
      occurrenceCount: 1,
    });
  });

  it("removes its Occurrences, its Enrichment and a pattern left without an Occurrence, and keeps the Exercises and Attempts", async () => {
    const session = await openDatabase();
    const first = await foldFirst(session);
    await answer(
      session,
      await patternIdOf(session, MistakeCategory.PREPOSITIONS),
      true
    );

    await session.run(deleteEvaluation(first.id));

    const stored = await session.query((client) =>
      Promise.all([
        client.select().from(mistakePatterns),
        client.select().from(occurrences),
        client.select().from(enrichments),
        client.select().from(exercises),
        client.select().from(exerciseAttempts),
      ])
    );
    expect(stored.map((rows) => rows.length)).toStrictEqual([0, 0, 0, 1, 1]);
    expect(stored[3].map((exercise) => exercise.sourcePatternId)).toStrictEqual(
      [null]
    );
  });

  it("leaves the Learner's patterns as they were when another Learner names the Evaluation", async () => {
    const session = await openDatabase();
    const first = await foldFirst(session);
    const before = await patternsOf(session);
    await session.query((client) =>
      client.insert(learners).values({ id: "intruder" })
    );

    await session.run(
      deleteEvaluation(first.id).pipe(
        Effect.provideService(
          CurrentLearner,
          CurrentLearner.of({ id: "intruder" as LearnerId })
        )
      )
    );

    expect(await patternsOf(session)).toStrictEqual(before);
    const kept = await session.query((client) =>
      Promise.all([
        client.select({ id: evaluations.id }).from(evaluations),
        client.select().from(occurrences),
      ])
    );
    expect([kept[0], kept[1].length]).toStrictEqual([[{ id: first.id }], 4]);
  });
});
