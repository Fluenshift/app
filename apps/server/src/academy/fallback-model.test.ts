// Grifando #77: with the primary Trainer model overloaded, the fallback answers, and the record
// that answer leaves names the fallback model, not the primary one Grifando chose before the call
// (docs/adr/0012). Each case wraps an overloaded primary and a working fallback in
// `withResilience`, as the issue's reproduction does, and reads the stored record back from a
// fresh PGlite database, for the local Learner.
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";

import { MistakeCategory } from "@grifando/contract";
import {
  Database,
  enrichments,
  exercises,
  interviewTurns,
  learners,
  mistakePatterns,
} from "@grifando/db";
import type { DrizzleClient } from "@grifando/db";
import { Effect } from "effect";
import type { Layer } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { persistEvaluation } from "../history/learning-history";
import type { Evaluation } from "../history/learning-history";
import { LOCAL_LEARNER_ID } from "../learner-identity";
import { makeTemporaryDatabase } from "../test/database";
import { generatePracticeSet } from "./exercise-service";
import { startInterview } from "./interview-service";
import { foldEvaluation } from "./pattern-folding";
import { withResilience } from "./trainer/resilience";
import { TrainerUnavailableError } from "./trainer/trainer-errors";
import type { TrainerMethods } from "./trainer/trainer-model";

let database: Awaited<ReturnType<typeof makeTemporaryDatabase>>;

const run = <A, E>(
  effect: Effect.Effect<A, E, Layer.Success<typeof database.layer>>
) => Effect.runPromise(effect.pipe(Effect.provide(database.layer)));

const query = <A>(read: (client: DrizzleClient) => Promise<A>) =>
  run(
    Effect.gen(function* () {
      const service = yield* Database;
      return yield* service.run(read);
    })
  );

beforeEach(async () => {
  database = await makeTemporaryDatabase();
});

afterEach(async () => {
  await rm(database.directory, { force: true, recursive: true });
});

const FALLBACK_MODEL = "fallback-model";

// A primary model that is overloaded on every call.
const overloadedPrimary: TrainerMethods = {
  continueInterview: () => Effect.fail(new TrainerUnavailableError()),
  enrichFindings: () => Effect.fail(new TrainerUnavailableError()),
  explainAttempt: () => Effect.fail(new TrainerUnavailableError()),
  generateExercises: () => Effect.fail(new TrainerUnavailableError()),
};

// A fallback model whose every answer names it.
const workingFallback: TrainerMethods = {
  continueInterview: () =>
    Effect.succeed({
      model: FALLBACK_MODEL,
      question: "Tell me about a bug you fixed.",
    }),
  enrichFindings: (input) =>
    Effect.succeed({
      findings: input.findings.map(() => ({
        category: MistakeCategory.PREPOSITIONS,
        example: "It depends on the cache.",
        l1Transfer: false,
        patternKey: "preposition:depend",
      })),
      model: FALLBACK_MODEL,
      naturalVersion: "I rely on this library.",
      naturalnessNotes: [],
    }),
  explainAttempt: () =>
    Effect.succeed({ explanation: "Use 'on'.", model: FALLBACK_MODEL }),
  generateExercises: (targets) =>
    Effect.succeed({
      exercises: targets.map(() => ({
        correctOptionIndex: 1,
        explanation: "Use 'depend on', not 'depend of'.",
        instruction: "Choose the correct sentence.",
        options: ["I depend of this library.", "I depend on this library."],
        type: "MULTIPLE_CHOICE" as const,
      })),
      model: FALLBACK_MODEL,
    }),
};

const trainer = withResilience(overloadedPrimary, workingFallback, {
  timeout: "1 second",
});

describe("Grifando #77: the fallback model on the stored record", () => {
  it("records the fallback model on the Enrichment of a folded Evaluation", async () => {
    const writingSample = "I depend of this library.";
    const evaluation: Evaluation = {
      band: "Understandable",
      correctedText: "I depend on this library.",
      evaluatedAt: "2026-11-15T12:00:00.000Z",
      evaluatedEnglishWordCount: 5,
      findings: [
        {
          byteEnd: 11,
          byteStart: 9,
          category: "Preposition",
          correction: "on",
          explanation: "'Depend' takes 'on'.",
          originalText: "of",
          severity: "Moderate",
        },
      ],
      id: randomUUID(),
      model: "judge-model",
      originalText: writingSample,
      provider: "openrouter",
      rubricVersion: "1",
      score: 70,
      suggestions: [],
      summary: "One preposition slip.",
    };
    await run(
      persistEvaluation({
        contentHash: "hash",
        evaluation,
        latencyMilliseconds: 1,
        submittedAt: evaluation.evaluatedAt,
      })
    );

    await run(foldEvaluation(trainer, { evaluationId: evaluation.id }));

    const stored = await query((client) => client.select().from(enrichments));
    expect(stored.map((row) => row.model)).toStrictEqual([FALLBACK_MODEL]);
  });

  it("records the fallback model on the Exercises it wrote", async () => {
    await query((client) =>
      client
        .insert(learners)
        .values({ id: LOCAL_LEARNER_ID })
        .then(() =>
          client.insert(mistakePatterns).values({
            category: MistakeCategory.PREPOSITIONS,
            exampleCorrection: "I depend on this library.",
            exampleOriginal: "I depend of this library.",
            id: randomUUID(),
            learnerId: LOCAL_LEARNER_ID,
            patternKey: "preposition:depend",
          })
        )
    );

    await run(generatePracticeSet(trainer, 1));

    const stored = await query((client) => client.select().from(exercises));
    expect(stored.map((row) => row.model)).toStrictEqual([FALLBACK_MODEL]);
  });

  it("records the fallback model on the interview question it asked", async () => {
    await run(startInterview(trainer));

    const stored = await query((client) =>
      client.select().from(interviewTurns)
    );
    expect(stored.map((row) => row.model)).toStrictEqual([FALLBACK_MODEL]);
  });
});
