// Characterization of apps/server/src/evaluation/writing-evaluation.ts and
// evaluation-endpoint.ts at the PE baseline: refusals that writing-evaluation.test.ts never
// triggers. A whitespace-only sample, an assessment with an undeclared property, a Finding inside
// model-identified non-English text, and the endpoint code of a missing configuration.
import { afterEach, describe, expect, it } from "bun:test";
import { rm } from "node:fs/promises";

import { Effect, Layer } from "effect";

import { listEvaluations } from "../history/learning-history";
import { makeTemporaryDatabase } from "../test/database";
import { evaluateWritingForEndpoint } from "./evaluation-endpoint";
import { EvaluationModel, EvaluationModelError } from "./evaluation-model";
import type { ModelEvaluation } from "./evaluation-model";
import { evaluateWriting } from "./writing-evaluation";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
});

const emptyAssessment = {
  findings: [],
  nonEnglishSpans: [],
  suggestions: [],
  summary: "No demonstrable English errors.",
};

// A database and a model that answers with `answer`, counting its calls.
const withModel = async (
  answer: () => Effect.Effect<ModelEvaluation, EvaluationModelError>
) => {
  const database = await makeTemporaryDatabase();
  directories.push(database.directory);
  const calls = { count: 0 };
  return {
    calls,
    layer: Layer.merge(
      database.layer,
      EvaluationModel.fake(() => {
        calls.count += 1;
        return answer();
      })
    ),
  };
};

const answering = (assessment: unknown) => () =>
  Effect.succeed({
    assessment,
    latencyMilliseconds: 1,
    model: "deterministic-test-model",
    provider: "test",
  });

describe("Writing Evaluation guards", () => {
  it("refuses a whitespace-only Writing Sample before calling the model", async () => {
    const model = await withModel(answering(emptyAssessment));
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const failure = yield* evaluateWriting(" \n\t ", new Date()).pipe(
          Effect.flip
        );
        return { failure, retained: yield* listEvaluations() };
      }).pipe(Effect.provide(model.layer))
    );

    expect(result.failure).toMatchObject({
      _tag: "InvalidWritingSampleError",
      reason: "Writing Sample must contain meaningful text",
    });
    expect(result.retained).toEqual([]);
    expect(model.calls.count).toBe(0);
  });

  it("refuses an assessment with a property the schema does not declare", async () => {
    const model = await withModel(
      answering({ ...emptyAssessment, confidence: 0.9 })
    );
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const failure = yield* evaluateWriting(
          "Clear English writing.",
          new Date()
        ).pipe(Effect.flip);
        return { failure, retained: yield* listEvaluations() };
      }).pipe(Effect.provide(model.layer))
    );

    expect(result.failure).toMatchObject({
      _tag: "InvalidAssessmentError",
      reason: "Model returned an invalid structured assessment",
    });
    expect(result.retained).toEqual([]);
  });

  it("refuses a Finding inside model-identified non-English text", async () => {
    const english = "Please fix teh text.\n";
    const nonEnglish = "Não altere isto.";
    const sample = `${english}${nonEnglish}`;
    const nonEnglishStart = Buffer.byteLength(english, "utf-8");
    const altereStart = Buffer.byteLength(
      sample.slice(0, sample.indexOf("altere")),
      "utf-8"
    );
    const model = await withModel(
      answering({
        findings: [
          {
            byteEnd: altereStart + Buffer.byteLength("altere", "utf-8"),
            byteStart: altereStart,
            category: "Spelling",
            correction: "altera",
            explanation: "A Correction inside non-English text.",
            originalText: "altere",
            severity: "Minor",
          },
        ],
        nonEnglishSpans: [
          {
            byteEnd: nonEnglishStart + Buffer.byteLength(nonEnglish, "utf-8"),
            byteStart: nonEnglishStart,
            originalText: nonEnglish,
          },
        ],
        suggestions: [],
        summary: "One Finding on non-English text.",
      })
    );
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const failure = yield* evaluateWriting(sample, new Date()).pipe(
          Effect.flip
        );
        return { failure, retained: yield* listEvaluations() };
      }).pipe(Effect.provide(model.layer))
    );

    expect(result.failure).toMatchObject({
      _tag: "UnsafeCorrectionError",
      reason: "Assessment contains overlapping correction spans",
    });
    expect(result.retained).toEqual([]);
  });

  it("answers a missing model configuration as configuration-missing, not retryable", async () => {
    const model = await withModel(() =>
      Effect.fail(
        new EvaluationModelError({
          kind: "configuration",
          reason: "OPENROUTER_API_KEY is not configured",
          recoverable: false,
        })
      )
    );
    const result = await Effect.runPromise(
      evaluateWritingForEndpoint("Clear English writing.", new Date()).pipe(
        Effect.provide(model.layer)
      )
    );

    expect(result).toEqual({
      code: "configuration-missing",
      kind: "failure",
      retryable: false,
    });
  });
});
