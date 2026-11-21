// One deterministic Evaluation for the Docker smoke (G6), written into the data directory of a
// local profile. Ported from PE apps/server/src/test/seed-docker-smoke.ts, which PE ran inside
// its container: PGlite admits one process at a time, so the smoke runs this on the host while no
// container holds the directory. The fake Judge answers one Finding on "fail", and the product's
// own pipeline checks, scores, bands and stores the Evaluation, for the local Learner.
import path from "node:path";

import { Database } from "@fluenshift/db";
import { ServerConfig } from "@fluenshift/env";
import { ConfigProvider, Effect, Layer } from "effect";

import { EvaluationModel } from "../evaluation/evaluation-model";
import { evaluateWriting } from "../evaluation/writing-evaluation";
import { CurrentLearner } from "../learner-identity";

const MIGRATIONS = path.resolve(
  import.meta.dirname,
  "../../../../packages/db/src/migrations"
);
const FIXED_TIMESTAMP = new Date("2026-09-08T12:00:00.000Z");

/** Where to write the Evaluation, and the Writing Sample it evaluates. */
export interface DockerSmokeSeed {
  readonly dataDirectory: string;
  readonly writingSample: string;
}

const judgeOf = (writingSample: string) => {
  const findingStart = writingSample.indexOf("fail");
  if (findingStart === -1) {
    throw new Error("the Docker smoke's Writing Sample must contain 'fail'");
  }
  const byteStart = new TextEncoder().encode(
    writingSample.slice(0, findingStart)
  ).length;
  return EvaluationModel.fake(() =>
    Effect.succeed({
      assessment: {
        findings: [
          {
            byteEnd: byteStart + 4,
            byteStart,
            category: "Verb form/tense",
            correction: "fails",
            explanation: "A singular subject needs a singular verb.",
            originalText: "fail",
            severity: "Minor",
          },
        ],
        nonEnglishSpans: [],
        suggestions: [],
        summary: "One local agreement error.",
      },
      latencyMilliseconds: 1,
      model: "deterministic-docker-smoke-model",
      provider: "test",
    })
  );
};

/** Writes the Evaluation and answers its id. */
export const seedDockerSmoke = (seed: DockerSmokeSeed): Promise<string> => {
  const config = ServerConfig.layer.pipe(
    Layer.provide(
      ConfigProvider.layer(
        ConfigProvider.fromEnvRecord({
          DATA_DIRECTORY: seed.dataDirectory,
          MIGRATIONS_PATH: MIGRATIONS,
        })
      )
    )
  );
  return Effect.runPromise(
    evaluateWriting(
      seed.writingSample,
      FIXED_TIMESTAMP,
      () => FIXED_TIMESTAMP
    ).pipe(
      Effect.map((evaluation) => evaluation.id),
      Effect.provide(
        Layer.mergeAll(
          Database.layer.pipe(Layer.provide(config)),
          config,
          CurrentLearner.local,
          judgeOf(seed.writingSample)
        )
      )
    )
  );
};
