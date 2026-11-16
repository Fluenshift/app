// Ported from Grifando src/server/domain/writing/writingCoachService.test.ts (74dbb9f) under
// docs/adr/0004. Grifando's own analysis call is retired: each case stores an Evaluation whose
// Findings are the mistakes that call returned, and a fake Trainer answers the Enrichment with
// their Academy fields. Each case runs on a fresh PGlite database, for the local Learner. The
// failed-session and retry cases are superseded: a failed Evaluation stores nothing.
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";

import { MistakeCategory } from "@fluenshift/contract";
import type { ErrorCategory } from "@fluenshift/contract";
import {
  Database,
  enrichments,
  evaluations,
  learners,
  mistakePatterns,
  occurrences,
} from "@fluenshift/db";
import type { DrizzleClient } from "@fluenshift/db";
import { Effect, Exit } from "effect";
import type { Layer } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteEvaluation,
  getEvaluation,
  persistEvaluation,
} from "../history/learning-history";
import type {
  Evaluation,
  EvaluationFinding,
} from "../history/learning-history";
import { LOCAL_LEARNER_ID } from "../learner-identity";
import { makeTemporaryDatabase } from "../test/database";
import { listPatterns } from "./mistake-pattern-repository";
import { foldEvaluation } from "./pattern-folding";
import type {
  FindingEnrichment,
  TrainerMethods,
} from "./trainer/trainer-model";

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

interface FixtureFinding {
  readonly category: ErrorCategory;
  readonly correction: string;
  readonly explanation: string;
  readonly originalText: string;
}

// Stores an Evaluation of `writingSample` with these Findings, located in order. The samples are
// ASCII, so a span's byte offsets are its character offsets.
const storeEvaluation = (
  writingSample: string,
  correctedText: string,
  fixtureFindings: readonly FixtureFinding[],
  rubricVersion = "1"
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
      severity: "Moderate",
    });
  }
  const evaluation: Evaluation = {
    band: "Understandable",
    correctedText,
    evaluatedAt: "2026-11-15T12:00:00.000Z",
    evaluatedEnglishWordCount: 10,
    findings,
    id: randomUUID(),
    model: "judge-model",
    originalText: writingSample,
    provider: "openrouter",
    rubricVersion,
    score: 70,
    suggestions: [],
    summary: "Nice, just one preposition slip.",
  };
  return run(
    persistEvaluation({
      contentHash: "hash",
      evaluation,
      latencyMilliseconds: 1,
      submittedAt: evaluation.evaluatedAt,
    })
  ).then(() => evaluation);
};

// A Trainer whose Enrichment answers these Academy fields.
const trainerAnswering = (
  findings: readonly FindingEnrichment[],
  model = "test-model"
) => ({
  continueInterview: vi.fn<TrainerMethods["continueInterview"]>(),
  enrichFindings: vi.fn<TrainerMethods["enrichFindings"]>(() =>
    Effect.succeed({ findings, model })
  ),
  explainAttempt: vi.fn<TrainerMethods["explainAttempt"]>(),
  generateExercises: vi.fn<TrainerMethods["generateExercises"]>(),
});

const dependOf: FixtureFinding = {
  category: "Preposition",
  correction: "depend on",
  explanation: "Use 'depend on', not 'depend of'.",
  originalText: "depend of",
};

const dependOfAgain: FixtureFinding = {
  category: "Preposition",
  correction: "depend on this too",
  explanation: "Same preposition mistake again.",
  originalText: "depend of this too",
};

const dependOn = (): FindingEnrichment => ({
  category: MistakeCategory.PREPOSITIONS,
  example: "I depend on my team.",
  l1Transfer: false,
  patternKey: "depend-on",
});

const dependOnAgain = (): FindingEnrichment => ({
  ...dependOn(),
  example: "This depends on the config.",
});

const storedOccurrences = () =>
  query((client) => client.select().from(occurrences));

const storedEnrichments = () =>
  query((client) => client.select().from(enrichments));

describe("PatternFolding.foldEvaluation", () => {
  it("persists the Enrichment and folds repeated Findings into one pattern", async () => {
    const evaluation = await storeEvaluation(
      "I depend of this library, and I depend of this too.",
      "I depend on this library, and I depend on this too.",
      [dependOf, dependOfAgain]
    );
    const trainer = trainerAnswering([dependOn(), dependOnAgain()]);

    const result = await run(
      foldEvaluation(trainer, { evaluationId: evaluation.id })
    );

    expect(result?.occurrences).toHaveLength(2);
    expect(await storedEnrichments()).toHaveLength(1);
    // The Academy writes no Evaluation data.
    const stored = await run(getEvaluation(evaluation.id));
    expect(stored?.correctedText).toBe(
      "I depend on this library, and I depend on this too."
    );

    const patterns = await run(listPatterns());
    expect(patterns).toHaveLength(1);
    expect(patterns[0]?.occurrenceCount).toBe(2);
  });

  it("stores the Portuguese-interference flag and filters patterns by it", async () => {
    const evaluation = await storeEvaluation(
      "I depend of the it.",
      "I depend on it.",
      [
        dependOf,
        {
          category: "Article",
          correction: "it",
          explanation: "No article before a pronoun.",
          originalText: "the it",
        },
      ]
    );
    const trainer = trainerAnswering([
      { ...dependOn(), l1Transfer: true },
      {
        ...dependOn(),
        category: MistakeCategory.ARTICLES,
        l1Transfer: false,
        patternKey: "the-article",
      },
    ]);

    await run(foldEvaluation(trainer, { evaluationId: evaluation.id }));

    const stored = await storedOccurrences();
    const flagged = stored.filter((occurrence) => occurrence.l1Transfer);
    expect(flagged).toHaveLength(1);

    expect(await run(listPatterns())).toHaveLength(2);
    const fromPortuguese = await run(listPatterns({ l1TransferOnly: true }));
    expect(fromPortuguese.map((pattern) => pattern.patternKey)).toEqual([
      "depend-on",
    ]);
  });

  it("drops a MASTERED pattern to IMPROVING when the mistake reappears in writing", async () => {
    await query((client) =>
      client
        .insert(learners)
        .values({ id: LOCAL_LEARNER_ID })
        .then(() =>
          client.insert(mistakePatterns).values({
            category: MistakeCategory.PREPOSITIONS,
            exampleCorrection: "depend on",
            exampleOriginal: "depend of",
            id: randomUUID(),
            learnerId: LOCAL_LEARNER_ID,
            masteryLevel: "MASTERED",
            patternKey: "depend-on",
          })
        )
    );
    const evaluation = await storeEvaluation(
      "I depend of it.",
      "I depend on it.",
      [dependOf]
    );
    const trainer = trainerAnswering([dependOn()]);

    await run(foldEvaluation(trainer, { evaluationId: evaluation.id }));

    const [pattern] = await run(listPatterns());
    expect(pattern?.masteryLevel).toBe("IMPROVING");
    expect(pattern?.consecutiveCorrectCount).toBe(0);
  });

  it("passes codeSnippet to the Trainer but never persists it", async () => {
    const evaluation = await storeEvaluation(
      "This function checks whether the user already exist.",
      "This function checks whether the user already exists.",
      [
        {
          category: "Verb form/tense",
          correction: "exists",
          explanation: "A singular subject takes 'exists'.",
          originalText: "exist",
        },
      ]
    );
    const trainer = trainerAnswering([
      {
        category: MistakeCategory.SUBJECT_VERB_AGREEMENT,
        example: "The file exists.",
        l1Transfer: false,
        patternKey: "third-person-s",
      },
    ]);

    await run(
      foldEvaluation(trainer, {
        codeSnippet: "export async function registerUser() {}",
        evaluationId: evaluation.id,
      })
    );

    expect(trainer.enrichFindings).toHaveBeenCalledWith(
      expect.objectContaining({
        codeSnippet: "export async function registerUser() {}",
      })
    );

    const [enrichment] = await storedEnrichments();
    expect(enrichment).not.toHaveProperty("codeSnippet");
    const stored = await Promise.all([
      query((client) => client.select().from(evaluations)),
      storedOccurrences(),
      storedEnrichments(),
    ]);
    expect(JSON.stringify(stored)).not.toContain("registerUser");
  });

  it("records each Occurrence with its Finding, the Enrichment's fields and the Rubric Version", async () => {
    const evaluation = await storeEvaluation(
      "I depend of the it.",
      "I depend on it.",
      [
        dependOf,
        {
          category: "Article",
          correction: "it",
          explanation: "No article before a pronoun.",
          originalText: "the it",
        },
      ],
      "2"
    );
    const trainer = trainerAnswering([
      { ...dependOn(), l1Transfer: true },
      {
        category: MistakeCategory.ARTICLES,
        example: "It works.",
        l1Transfer: false,
        patternKey: "no-article-before-pronoun",
      },
    ]);

    const result = await run(
      foldEvaluation(trainer, { evaluationId: evaluation.id })
    );

    expect(result?.occurrences).toMatchObject([
      {
        category: "PREPOSITIONS",
        correctedSpan: "depend on",
        evaluationId: evaluation.id,
        example: "I depend on my team.",
        explanation: "Use 'depend on', not 'depend of'.",
        findingPosition: 0,
        l1Transfer: true,
        originalSpan: "depend of",
        rubricVersion: "2",
        severity: "ERROR",
      },
      {
        category: "ARTICLES",
        correctedSpan: "it",
        evaluationId: evaluation.id,
        example: "It works.",
        explanation: "No article before a pronoun.",
        findingPosition: 1,
        l1Transfer: false,
        originalSpan: "the it",
        rubricVersion: "2",
        severity: "ERROR",
      },
    ]);
    expect(await storedOccurrences()).toHaveLength(2);
  });

  it("records the model that answered the Enrichment", async () => {
    const evaluation = await storeEvaluation(
      "I depend of it.",
      "I depend on it.",
      [dependOf]
    );
    const trainer = trainerAnswering([dependOn()], "fallback-model");

    await run(foldEvaluation(trainer, { evaluationId: evaluation.id }));

    const [enrichment] = await storedEnrichments();
    expect(enrichment?.evaluationId).toBe(evaluation.id);
    expect(enrichment?.model).toBe("fallback-model");
  });

  it("leaves Clarity and Other Findings out of the Mistake Patterns", async () => {
    const evaluation = await storeEvaluation(
      "Do the thing with it before. I depend of it.",
      "Do the thing with the report before the review. I depend on it.",
      [
        {
          category: "Clarity",
          correction: "the report before the review",
          explanation: "Neither 'it' nor 'before' says what is meant.",
          originalText: "it before",
        },
        dependOf,
      ]
    );
    const trainer = trainerAnswering([dependOn()]);

    const result = await run(
      foldEvaluation(trainer, { evaluationId: evaluation.id })
    );

    expect(trainer.enrichFindings).toHaveBeenCalledWith(
      expect.objectContaining({
        findings: [
          {
            category: "Preposition",
            correction: "depend on",
            explanation: "Use 'depend on', not 'depend of'.",
            originalText: "depend of",
          },
        ],
      })
    );
    expect(
      result?.occurrences.map((occurrence) => occurrence.findingPosition)
    ).toStrictEqual([1]);
  });

  it("asks the Trainer nothing when no Finding can form a Mistake Pattern", async () => {
    const evaluation = await storeEvaluation(
      "Ship it, the thing.",
      "Ship the release.",
      [
        {
          category: "Other",
          correction: "the release",
          explanation: "The sentence names nothing to ship.",
          originalText: "it, the thing",
        },
      ]
    );
    const trainer = trainerAnswering([]);

    const result = await run(
      foldEvaluation(trainer, { evaluationId: evaluation.id })
    );

    expect(trainer.enrichFindings).not.toHaveBeenCalled();
    expect(result).toStrictEqual({ occurrences: [] });
    expect(await storedEnrichments()).toHaveLength(0);
  });

  it("answers null and asks the Trainer nothing for an Evaluation the Learner does not have", async () => {
    const trainer = trainerAnswering([dependOn()]);

    const result = await run(
      foldEvaluation(trainer, { evaluationId: randomUUID() })
    );

    expect(result).toBeNull();
    expect(trainer.enrichFindings).not.toHaveBeenCalled();
  });

  it("refuses to fold an Evaluation twice, leaving its patterns as the first fold left them", async () => {
    const evaluation = await storeEvaluation(
      "I depend of it.",
      "I depend on it.",
      [dependOf]
    );
    const trainer = trainerAnswering([dependOn()]);
    await run(foldEvaluation(trainer, { evaluationId: evaluation.id }));

    const second = await Effect.runPromiseExit(
      foldEvaluation(trainer, { evaluationId: evaluation.id }).pipe(
        Effect.provide(database.layer)
      )
    );

    expect(Exit.isFailure(second)).toBe(true);
    const [pattern] = await run(listPatterns());
    expect(pattern?.occurrenceCount).toBe(1);
    expect(await storedOccurrences()).toHaveLength(1);
  });

  it("deletes the Enrichment and its Occurrences with their Evaluation", async () => {
    const evaluation = await storeEvaluation(
      "I depend of it.",
      "I depend on it.",
      [dependOf]
    );
    await run(
      foldEvaluation(trainerAnswering([dependOn()]), {
        evaluationId: evaluation.id,
      })
    );

    await run(deleteEvaluation(evaluation.id));

    expect(await storedOccurrences()).toHaveLength(0);
    expect(await storedEnrichments()).toHaveLength(0);
  });
});
