// Builds a small PE local database with PE's own code at its pin (5e831bb): the input of the
// importer's tests, apps/server/src/history/fixtures/pe-local.db (issue #274, ADR 0018).
//
// Run it with Bun in a disposable PE worktree, from that worktree's root:
//
//   node scripts/migration/baselines.ts add-worktree pe importer-fixture     (in Fluenshift)
//   cd ../app-baselines/worktrees/pe-importer-fixture
//   bun install --frozen-lockfile
//   cp <Fluenshift>/migration/fixtures/pe/local-database.ts apps/server/src/
//   bun apps/server/src/local-database.ts <empty output directory>
//   cp <empty output directory>/local.db <Fluenshift>/apps/server/src/history/fixtures/pe-local.db
//
// PE's Database layer creates the file and applies PE's migration. PE's evaluateWriting then
// evaluates five Writing Samples, with a fake EvaluationModel and a fixed clock, so PE itself
// orders the Findings, applies the Corrections, counts the English words, derives the score and
// band, and hashes the text. PE's deleteEvaluation removes the third, which leaves a gap in the
// rowids, and the foreign key's cascade removes its Finding. The last two Evaluations share one
// evaluated_at, so the file also holds the tie PE's History breaks by rowid.
//
// The file holds four Evaluations, six Findings and two Suggestions. The Writing Samples carry
// a newline, a two-byte and a four-byte character before their spans, a non-English span and
// Protected Technical Content; one Suggestion has no alternative; token counts are present,
// absent, and present for input only.
import path from "node:path";

import { Database } from "@english-prompt-evaluation/db";
import { ServerConfig } from "@english-prompt-evaluation/env/server";
import { Effect, Layer, ManagedRuntime, Option, Redacted } from "effect";

import { EvaluationModel } from "./evaluation/evaluation-model";
import type { ModelEvaluation } from "./evaluation/evaluation-model";
import { evaluateWriting } from "./evaluation/writing-evaluation";
import { deleteEvaluation } from "./history/learning-history";

const outputDirectory = process.argv[2];
if (outputDirectory === undefined) {
  throw new Error("usage: bun local-database.ts <empty output directory>");
}

const span = (sample: string, text: string) => {
  const byteStart = Buffer.from(sample, "utf-8").indexOf(
    Buffer.from(text, "utf-8")
  );
  if (byteStart < 0) {
    throw new Error(`${JSON.stringify(text)} is not in the sample`);
  }
  return {
    byteEnd: byteStart + Buffer.byteLength(text, "utf-8"),
    byteStart,
    originalText: text,
  };
};

interface FixtureSample {
  readonly evaluatedAt: string;
  readonly model: (text: string) => ModelEvaluation;
  readonly submittedAt: string;
  readonly text: string;
}

const MODEL = "openai/gpt-5.6-terra";
const PROVIDER = "OpenRouter";

const samples: readonly FixtureSample[] = [
  {
    evaluatedAt: "2026-09-01T10:00:02.000Z",
    model: (text) => ({
      assessment: {
        findings: [
          {
            ...span(text, "for you help"),
            category: "Grammar/syntax",
            correction: "for your help",
            explanation: "Use the possessive your before a noun.",
            severity: "Minor",
          },
          {
            ...span(text, "I has finished"),
            category: "Verb form/tense",
            correction: "I finished",
            explanation:
              "With a finished time such as yesterday, use the simple past.",
            severity: "Moderate",
          },
          {
            ...span(text, "merge it in main"),
            category: "Preposition",
            correction: "merge it into main",
            explanation: "Changes are merged into a branch.",
            severity: "Minor",
          },
        ],
        nonEnglishSpans: [],
        suggestions: [
          {
            ...span(text, "Please review"),
            alternative: "Could you review",
            explanation:
              "A question can sound softer; which fits depends on how you address this colleague.",
          },
        ],
        summary:
          "A clear request with a tense error, a preposition slip and a missing possessive.",
      },
      inputTokens: 812,
      latencyMilliseconds: 1830,
      model: MODEL,
      outputTokens: 164,
      provider: PROVIDER,
    }),
    submittedAt: "2026-09-01T10:00:00.000Z",
    text: "Hi Zoë,\n\nI has finished the migration yesterday. Please review the `deploy.sh` script before we merge it in main. Thanks for you help!",
  },
  {
    evaluatedAt: "2026-09-02T08:15:01.000Z",
    model: () => ({
      assessment: {
        findings: [],
        nonEnglishSpans: [],
        suggestions: [],
        summary: "No demonstrable English errors.",
      },
      latencyMilliseconds: 940,
      model: MODEL,
      provider: PROVIDER,
    }),
    submittedAt: "2026-09-02T08:15:00.000Z",
    text: "The release notes are ready, and the changelog lists every fix since version 2.3.",
  },
  {
    // Deleted below.
    evaluatedAt: "2026-09-02T17:45:03.000Z",
    model: (text) => ({
      assessment: {
        findings: [
          {
            ...span(text, "We was"),
            category: "Verb form/tense",
            correction: "We were",
            explanation: "A plural subject takes were.",
            severity: "Moderate",
          },
        ],
        nonEnglishSpans: [],
        suggestions: [],
        summary: "One agreement error.",
      },
      inputTokens: 590,
      latencyMilliseconds: 1104,
      model: MODEL,
      outputTokens: 98,
      provider: PROVIDER,
    }),
    submittedAt: "2026-09-02T17:45:00.000Z",
    text: "We was late to the standup because the train stopped.",
  },
  {
    evaluatedAt: "2026-09-03T09:30:00.000Z",
    model: (text) => ({
      assessment: {
        findings: [
          {
            ...span(text, "in tomorrow morning"),
            category: "Preposition",
            correction: "tomorrow morning",
            explanation: "Tomorrow morning takes no preposition.",
            severity: "Minor",
          },
        ],
        nonEnglishSpans: [span(text, "Obrigado pela ajuda!")],
        suggestions: [
          {
            ...span(text, "after the meeting with the team"),
            explanation:
              "Whether the meeting needs more detail depends on context the sample does not give.",
          },
        ],
        summary: "Understandable, with one unneeded preposition.",
      },
      inputTokens: 640,
      latencyMilliseconds: 1210,
      model: MODEL,
      outputTokens: 120,
      provider: PROVIDER,
    }),
    submittedAt: "2026-09-03T09:29:58.000Z",
    text: "Obrigado pela ajuda! I will send you the report in tomorrow morning, after the meeting with the team.",
  },
  {
    // The same moment as the previous Evaluation: PE's History puts this one first.
    evaluatedAt: "2026-09-03T09:30:00.000Z",
    model: (text) => ({
      assessment: {
        findings: [
          {
            ...span(text, "cannot to trust"),
            category: "Grammar/syntax",
            correction: "cannot trust",
            explanation: "Cannot takes a bare infinitive, without to.",
            severity: "Major",
          },
          {
            ...span(text, "numbers still looks"),
            category: "Verb form/tense",
            correction: "numbers still look",
            explanation: "A plural subject takes look.",
            severity: "Moderate",
          },
        ],
        nonEnglishSpans: [],
        suggestions: [],
        summary: "The meaning survives, but two verb errors slow the reader.",
      },
      inputTokens: 702,
      latencyMilliseconds: 1502,
      model: MODEL,
      provider: PROVIDER,
    }),
    submittedAt: "2026-09-03T09:29:59.000Z",
    text: "The cache was cleared 🎉 but the numbers still looks wrong, so we cannot to trust them yet.",
  },
];

const modelFor = new Map(
  samples.map((sample) => [sample.text, sample.model(sample.text)])
);

const config = Layer.succeed(
  ServerConfig,
  ServerConfig.of({
    dataDisplayPath: Option.none(),
    databaseUrl: Redacted.make(
      `file:${path.resolve(outputDirectory, "local.db")}`
    ),
    host: "127.0.0.1",
    migrationsPath: path.resolve(
      import.meta.dir,
      "../../../packages/db/src/migrations"
    ),
    nodeEnv: "production",
    port: 3000,
    webDistPath: "../web/dist",
  })
);

const runtime = ManagedRuntime.make(
  Layer.merge(
    Database.layer.pipe(Layer.provide(config)),
    EvaluationModel.fake((writingSample) => {
      const evaluation = modelFor.get(writingSample);
      return evaluation === undefined
        ? Effect.die(new Error("no fixture assessment for this sample"))
        : Effect.succeed(evaluation);
    })
  )
);

const ids: string[] = [];
for (const sample of samples) {
  const evaluation = await runtime.runPromise(
    evaluateWriting(
      sample.text,
      new Date(sample.submittedAt),
      () => new Date(sample.evaluatedAt)
    )
  );
  ids.push(evaluation.id);
}
await runtime.runPromise(deleteEvaluation(ids[2]));
await runtime.dispose();

console.log(
  JSON.stringify({ deleted: ids[2], kept: ids.filter((_, index) => index !== 2) })
);
