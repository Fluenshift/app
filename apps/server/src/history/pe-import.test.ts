// The one-time import of PE's local Learning History (docs/adr/0018, decision 2). Its input,
// fixtures/pe-local.db, is what PE's own code wrote at its pin: four Evaluations, six Findings and
// two Suggestions, after a fifth Evaluation was deleted. The script that wrote it, and how to run
// it again, stay in git history: `git show 8a379e2:migration/fixtures/pe/local-database.ts`.
import { copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  Database,
  evaluations,
  findings,
  learners,
  suggestions,
} from "@grifando/db";
import { ServerConfig } from "@grifando/env";
import { asc, count, sql } from "drizzle-orm";
import { ConfigProvider, Effect, Layer, pipe } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import { getProgressSummary } from "../progress/progress-insights";
import { makeTemporaryDatabase } from "../test/database";
import {
  deleteEvaluation,
  getEvaluation,
  listEvaluations,
  persistEvaluation,
} from "./learning-history";
import { importPeHistory, runPeImport } from "./pe-import";

const FIXTURE = path.join(import.meta.dirname, "fixtures/pe-local.db");
const MIGRATIONS = path.resolve(
  import.meta.dirname,
  "../../../../packages/db/src/migrations"
);

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
});

const scratchDirectory = async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "fluenshift-pe-"));
  directories.push(directory);
  return directory;
};

// A copy of the fixture in a directory of its own, changed by the statements given: SQLite writes
// its shared-memory and log files beside a database in WAL mode, even one it opens read-only.
const peDatabase = async (...statements: readonly string[]) => {
  const file = path.join(await scratchDirectory(), "local.db");
  await copyFile(FIXTURE, file);
  const pe = new DatabaseSync(file, { enableForeignKeyConstraints: false });
  for (const statement of statements) {
    pe.exec(statement);
  }
  pe.close();
  return file;
};

const productDatabase = async () => {
  const database = await makeTemporaryDatabase();
  directories.push(database.directory);
  return database;
};

const readPe = (file: string) => {
  const pe = new DatabaseSync(file, { readOnly: true });
  const rows = {
    evaluations: pe.prepare("select * from evaluations order by rowid").all(),
    findings: pe.prepare("select * from findings order by position").all(),
    suggestions: pe
      .prepare("select * from suggestions order by position")
      .all(),
  };
  pe.close();
  return rows;
};

// Each Evaluation of a PE database as Learning History shows one, in PE's insertion order.
const peDetails = (file: string) => {
  const rows = readPe(file);
  return rows.evaluations.map((evaluation) => ({
    band: evaluation.band,
    correctedText: evaluation.corrected_text,
    evaluatedAt: evaluation.evaluated_at,
    evaluatedEnglishWordCount: evaluation.evaluated_english_word_count,
    findings: rows.findings
      .filter((finding) => finding.evaluation_id === evaluation.id)
      .map((finding) => ({
        byteEnd: finding.byte_end,
        byteStart: finding.byte_start,
        category: finding.category,
        correction: finding.correction,
        explanation: finding.explanation,
        originalText: finding.original_text,
        severity: finding.severity,
      })),
    id: evaluation.id,
    model: evaluation.model,
    originalText: evaluation.original_text,
    provider: evaluation.provider,
    rubricVersion: evaluation.rubric_version,
    score: evaluation.score,
    suggestions: rows.suggestions
      .filter((suggestion) => suggestion.evaluation_id === evaluation.id)
      .map((suggestion) => ({
        ...(suggestion.alternative === null
          ? {}
          : { alternative: suggestion.alternative }),
        byteEnd: suggestion.byte_end,
        byteStart: suggestion.byte_start,
        explanation: suggestion.explanation,
        originalText: suggestion.original_text,
      })),
    summary: evaluation.summary,
  }));
};

// The columns of each PE Evaluation that Learning History does not show, as the product stores
// them, in PE's insertion order.
const peColumns = (file: string) =>
  readPe(file).evaluations.map((evaluation) => ({
    contentHash: evaluation.content_hash,
    id: evaluation.id,
    inputTokens: evaluation.input_tokens,
    latencyMilliseconds: evaluation.latency_milliseconds,
    learnerId: "local",
    origin: "work",
    outputTokens: evaluation.output_tokens,
    submittedAt: evaluation.submitted_at,
  }));

const productColumns = Effect.gen(function* () {
  const database = yield* Database;
  const rows = yield* database.run((client) =>
    client
      .select({
        contentHash: evaluations.contentHash,
        id: evaluations.id,
        inputTokens: evaluations.inputTokens,
        latencyMilliseconds: evaluations.latencyMilliseconds,
        learnerId: evaluations.learnerId,
        origin: evaluations.origin,
        outputTokens: evaluations.outputTokens,
        submittedAt: evaluations.submittedAt,
      })
      .from(evaluations)
      .orderBy(asc(evaluations.insertionOrder))
  );
  return rows.map((row) => ({
    ...row,
    submittedAt: row.submittedAt.toISOString(),
  }));
});

const tableCounts = Effect.gen(function* () {
  const database = yield* Database;
  const [evaluationRows, findingRows, learnerRows, suggestionRows] =
    yield* database.run((client) =>
      Promise.all([
        client.select({ rows: count() }).from(evaluations),
        client.select({ rows: count() }).from(findings),
        client.select({ rows: count() }).from(learners),
        client.select({ rows: count() }).from(suggestions),
      ])
    );
  return {
    evaluations: evaluationRows[0]?.rows,
    findings: findingRows[0]?.rows,
    learners: learnerRows[0]?.rows,
    suggestions: suggestionRows[0]?.rows,
  };
});

const NOTHING_WRITTEN = {
  evaluations: 0,
  findings: 0,
  learners: 0,
  suggestions: 0,
};

const run = <A, E, R, LayerError>(
  effect: Effect.Effect<A, E, R>,
  layer: Layer.Layer<R, LayerError>
) => Effect.runPromise(effect.pipe(Effect.provide(layer)));

// What a refused import answers, or that it was not refused.
const refusal = <
  A,
  E extends { readonly _tag: string; readonly message: string },
  R,
>(
  effect: Effect.Effect<A, E, R>
) =>
  effect.pipe(
    Effect.match({
      onFailure: (error) => `${error._tag}: ${error.message}`,
      onSuccess: () => "not refused",
    })
  );

const configFor = (environment: Record<string, string>) =>
  ServerConfig.layer.pipe(
    Layer.provide(
      ConfigProvider.layer(ConfigProvider.fromEnvRecord(environment))
    )
  );

const ZOE = {
  band: "Needs revision",
  correctedText:
    "Hi Zoë,\n\nI finished the migration yesterday. Please review the `deploy.sh` script before we merge it into main. Thanks for your help!",
  evaluatedAt: "2026-09-01T10:00:02.000Z",
  evaluatedEnglishWordCount: 22,
  findings: [
    {
      byteEnd: 24,
      byteStart: 10,
      category: "Verb form/tense",
      correction: "I finished",
      explanation:
        "With a finished time such as yesterday, use the simple past.",
      originalText: "I has finished",
      severity: "Moderate",
    },
    {
      byteEnd: 113,
      byteStart: 97,
      category: "Preposition",
      correction: "merge it into main",
      explanation: "Changes are merged into a branch.",
      originalText: "merge it in main",
      severity: "Minor",
    },
    {
      byteEnd: 134,
      byteStart: 122,
      category: "Grammar/syntax",
      correction: "for your help",
      explanation: "Use the possessive your before a noun.",
      originalText: "for you help",
      severity: "Minor",
    },
  ],
  id: "8b778665-bbce-4d50-8fa8-151f399b51bd",
  model: "openai/gpt-5.6-terra",
  originalText:
    "Hi Zoë,\n\nI has finished the migration yesterday. Please review the `deploy.sh` script before we merge it in main. Thanks for you help!",
  provider: "OpenRouter",
  rubricVersion: "1",
  score: 41,
  suggestions: [
    {
      alternative: "Could you review",
      byteEnd: 63,
      byteStart: 50,
      explanation:
        "A question can sound softer; which fits depends on how you address this colleague.",
      originalText: "Please review",
    },
  ],
  summary:
    "A clear request with a tense error, a preposition slip and a missing possessive.",
};

const FIXTURE_COUNTS = { evaluations: 4, findings: 6, suggestions: 2 };

// The fixture's Evaluations, in PE's insertion order.
const FIXTURE_EVALUATION_IDS = [
  "8b778665-bbce-4d50-8fa8-151f399b51bd",
  "d754a4c6-d8fe-48c2-b5c7-98d728ec6000",
  "04bf42b0-8ee7-49a4-90de-18136a5478eb",
  "a1c0cb43-bc6b-4f13-ac9d-6adb783340ec",
];

// An Evaluation the product made before the import, for the local Learner.
const PRODUCT_EVALUATION = {
  contentHash: "product-content-hash",
  evaluation: {
    band: "Natural" as const,
    correctedText: "The deploy finished.",
    evaluatedAt: "2026-11-20T12:00:01.000Z",
    evaluatedEnglishWordCount: 3,
    findings: [],
    id: "f3a2c1d0-0000-4000-8000-000000000001",
    model: "deterministic-test-model",
    originalText: "The deploy finished.",
    provider: "test",
    rubricVersion: "1-provisional",
    score: 100,
    suggestions: [],
    summary: "No demonstrable English errors.",
  },
  latencyMilliseconds: 12,
  submittedAt: "2026-11-20T12:00:00.000Z",
};

describe("PE import", () => {
  it("imports every Evaluation of a PE database with its Findings and Suggestions, for the local Learner", async () => {
    const file = await peDatabase();
    const database = await productDatabase();

    const counts = await run(
      importPeHistory(file, { dryRun: false }),
      database.layer
    );
    const imported = await run(
      Effect.gen(function* () {
        const details = yield* pipe(
          peDetails(file).map(({ id }) => String(id)),
          Effect.forEach((id) => getEvaluation(id))
        );
        return { columns: yield* productColumns, details };
      }),
      database.layer
    );

    expect(counts).toEqual(FIXTURE_COUNTS);
    expect(imported.details).toEqual(peDetails(file));
    expect(imported.details[0]).toEqual(ZOE);
    expect(imported.columns).toEqual(peColumns(file));
  });

  it("keeps PE's History order: newest first, and the later insertion first within one moment", async () => {
    const file = await peDatabase();
    const database = await productDatabase();

    await run(importPeHistory(file, { dryRun: false }), database.layer);
    const summaries = await run(listEvaluations(), database.layer);

    expect(summaries.map(({ id }) => id)).toEqual([
      "a1c0cb43-bc6b-4f13-ac9d-6adb783340ec",
      "04bf42b0-8ee7-49a4-90de-18136a5478eb",
      "d754a4c6-d8fe-48c2-b5c7-98d728ec6000",
      "8b778665-bbce-4d50-8fa8-151f399b51bd",
    ]);
  });

  it("imports beside the Evaluations the local Learner already has in the product, and keeps them", async () => {
    const file = await peDatabase();
    const database = await productDatabase();

    await run(persistEvaluation(PRODUCT_EVALUATION), database.layer);
    const counts = await run(
      importPeHistory(file, { dryRun: false }),
      database.layer
    );
    const summaries = await run(listEvaluations(), database.layer);

    expect(counts).toEqual(FIXTURE_COUNTS);
    expect(summaries.map(({ id }) => id)).toEqual([
      "f3a2c1d0-0000-4000-8000-000000000001",
      "a1c0cb43-bc6b-4f13-ac9d-6adb783340ec",
      "04bf42b0-8ee7-49a4-90de-18136a5478eb",
      "d754a4c6-d8fe-48c2-b5c7-98d728ec6000",
      "8b778665-bbce-4d50-8fa8-151f399b51bd",
    ]);
  });

  it("reports the counts of a dry run and writes nothing", async () => {
    const file = await peDatabase();
    const database = await productDatabase();

    const counts = await run(
      importPeHistory(file, { dryRun: true }),
      database.layer
    );
    const written = await run(tableCounts, database.layer);

    expect(counts).toEqual(FIXTURE_COUNTS);
    expect(written).toEqual(NOTHING_WRITTEN);
  });

  it("refuses a second import, dry or not, while the product holds any of the database's Evaluations", async () => {
    const file = await peDatabase();
    const database = await productDatabase();

    await run(importPeHistory(file, { dryRun: false }), database.layer);
    const refusals = await run(
      Effect.gen(function* () {
        const again = yield* refusal(importPeHistory(file, { dryRun: false }));
        const dryRun = yield* refusal(importPeHistory(file, { dryRun: true }));
        yield* deleteEvaluation("8b778665-bbce-4d50-8fa8-151f399b51bd");
        const afterDeletion = yield* refusal(
          importPeHistory(file, { dryRun: false })
        );
        return { afterDeletion, again, dryRun };
      }),
      database.layer
    );
    const written = await run(tableCounts, database.layer);

    expect(refusals.again).toBe(
      "PeImportError: the product already holds 4 of the 4 Evaluations of this PE database: the import ran before"
    );
    expect(refusals.dryRun).toBe(
      "PeImportError: the product already holds 4 of the 4 Evaluations of this PE database: the import ran before"
    );
    expect(refusals.afterDeletion).toBe(
      "PeImportError: the product already holds 3 of the 4 Evaluations of this PE database: the import ran before"
    );
    expect(written).toEqual({
      evaluations: 3,
      findings: 3,
      learners: 1,
      suggestions: 1,
    });
  });

  it("refuses a second import, dry or not, once the Learner deleted every imported Evaluation", async () => {
    const file = await peDatabase();
    const database = await productDatabase();

    await run(importPeHistory(file, { dryRun: false }), database.layer);
    const refusals = await run(
      Effect.gen(function* () {
        yield* pipe(
          FIXTURE_EVALUATION_IDS,
          Effect.forEach((id) => deleteEvaluation(id))
        );
        const again = yield* refusal(importPeHistory(file, { dryRun: false }));
        const dryRun = yield* refusal(importPeHistory(file, { dryRun: true }));
        return { again, dryRun };
      }),
      database.layer
    );
    const written = await run(tableCounts, database.layer);

    expect(refusals.again).toBe(
      "PeImportError: the product imported a PE database before (4 Evaluations, 6 Findings and 2 Suggestions): the import runs once"
    );
    expect(refusals.dryRun).toBe(
      "PeImportError: the product imported a PE database before (4 Evaluations, 6 Findings and 2 Suggestions): the import runs once"
    );
    expect(written).toEqual({ ...NOTHING_WRITTEN, learners: 1 });
  });

  it("refuses a PE database with no Evaluations, dry or not, so that the history can still be imported", async () => {
    const empty = await peDatabase(
      "delete from suggestions",
      "delete from findings",
      "delete from evaluations"
    );
    const file = await peDatabase();
    const database = await productDatabase();

    const outcomes = await run(
      Effect.gen(function* () {
        const emptyDryRun = yield* refusal(
          importPeHistory(empty, { dryRun: true })
        );
        const emptyImport = yield* refusal(
          importPeHistory(empty, { dryRun: false })
        );
        const historyImport = yield* refusal(
          importPeHistory(file, { dryRun: false })
        );
        return { emptyDryRun, emptyImport, historyImport };
      }),
      database.layer
    );

    expect(outcomes.emptyDryRun).toBe(
      "PeImportError: this PE database holds no Evaluations: there is nothing to import"
    );
    expect(outcomes.emptyImport).toBe(
      "PeImportError: this PE database holds no Evaluations: there is nothing to import"
    );
    expect(outcomes.historyImport).toBe("not refused");
  });

  it("refuses a PE database with an Evaluation of another Rubric Version, and writes nothing", async () => {
    const file = await peDatabase(
      "update evaluations set rubric_version = '2' where rowid = 2"
    );
    const database = await productDatabase();

    const refused = await run(
      refusal(importPeHistory(file, { dryRun: false })),
      database.layer
    );
    const written = await run(tableCounts, database.layer);

    expect(refused).toBe(
      "PeImportError: rows of this PE database that do not fit the product:\nevaluations row 2: rubric_version"
    );
    expect(written).toEqual(NOTHING_WRITTEN);
  });

  it("names each row that does not fit the product by its columns, never by its text, and writes nothing", async () => {
    const file = await peDatabase(
      "update evaluations set band = 'Fluent', score = 101 where rowid = 1",
      "update evaluations set input_tokens = -1, latency_milliseconds = 1.5 where rowid = 2",
      "update evaluations set original_text = original_text || char(0) where rowid = 4",
      "update evaluations set evaluated_at = '2026-09-03 09:30:00' where rowid = 5",
      "update findings set category = 'Tone' where id = 2",
      "update findings set byte_end = byte_start where id = 3",
      "update findings set position = 0 where id = 7",
      "update suggestions set alternative = char(0) where id = 1",
      "update suggestions set evaluation_id = 'missing' where id = 2"
    );
    const database = await productDatabase();

    const refused = await run(
      refusal(importPeHistory(file, { dryRun: true })),
      database.layer
    );
    const written = await run(tableCounts, database.layer);

    expect(refused).toBe(
      [
        "PeImportError: rows of this PE database that do not fit the product:",
        "evaluations row 1: band, score",
        "evaluations row 2: input_tokens, latency_milliseconds",
        "evaluations row 4: original_text",
        "evaluations row 5: evaluated_at",
        "findings row 2: category",
        "findings row 3: byte_end",
        "findings row 7: position",
        "suggestions row 1: alternative",
        "suggestions row 2: evaluation_id",
      ].join("\n")
    );
    expect(refused).not.toContain("Obrigado");
    expect(written).toEqual(NOTHING_WRITTEN);
  });

  it("refuses a file that is not a PE database", async () => {
    const directory = await scratchDirectory();
    const missing = path.join(directory, "missing.db");
    const notes = path.join(directory, "notes.txt");
    await writeFile(notes, "not a database");
    const other = path.join(directory, "other.db");
    const otherDatabase = new DatabaseSync(other);
    otherDatabase.exec("create table notes (body text)");
    otherDatabase.close();
    const database = await productDatabase();

    const refusals = await run(
      pipe(
        [missing, notes, other],
        Effect.forEach((file) =>
          refusal(importPeHistory(file, { dryRun: true }))
        )
      ),
      database.layer
    );

    expect(refusals).toEqual([
      `PeImportError: cannot read a PE database at ${missing}: unable to open database file`,
      `PeImportError: cannot read a PE database at ${notes}: file is not a database`,
      `PeImportError: cannot read a PE database at ${other}: no such table: evaluations`,
    ]);
  });

  it("keeps imported Evaluations in Rubric Version 1, apart from the provisional version in Progress", async () => {
    const file = await peDatabase();
    const database = await productDatabase();

    await run(importPeHistory(file, { dryRun: false }), database.layer);
    const summary = await run(
      getProgressSummary({ period: "all" }),
      database.layer
    );

    expect(summary.rubricVersion).toBe("1-provisional");
    expect(summary.evaluationCount).toBe(0);
    expect(
      summary.incompatibleSegments.map((segment) => ({
        averageScore: segment.averageScore,
        evaluatedEnglishWordCount: segment.evaluatedEnglishWordCount,
        evaluationCount: segment.evaluationCount,
        findingCount: segment.findingCount,
        rubricVersion: segment.rubricVersion,
      }))
    ).toEqual([
      {
        averageScore: 57.8,
        evaluatedEnglishWordCount: 67,
        evaluationCount: 4,
        findingCount: 6,
        rubricVersion: "1",
      },
    ]);
  });

  it("imports nothing when the product refuses a row, and names the refusal without the row's text", async () => {
    const file = await peDatabase();
    const database = await productDatabase();

    const refused = await run(
      Effect.gen(function* () {
        const product = yield* Database;
        yield* product.run((client) =>
          client.execute(
            sql`alter table findings add constraint test_no_minor_finding check (severity <> 'Minor')`
          )
        );
        return yield* refusal(importPeHistory(file, { dryRun: false }));
      }),
      database.layer
    );
    const written = await run(tableCounts, database.layer);
    // Once the product takes the rows again, the import runs: the failed one left no trace.
    const retried = await run(
      Effect.gen(function* () {
        const product = yield* Database;
        yield* product.run((client) =>
          client.execute(
            sql`alter table findings drop constraint test_no_minor_finding`
          )
        );
        return yield* importPeHistory(file, { dryRun: false });
      }),
      database.layer
    );

    expect(refused).toBe(
      'PeImportError: the product database failed, so nothing was imported: new row for relation "findings" violates check constraint "test_no_minor_finding"'
    );
    expect(refused).not.toContain("merge it in main");
    expect(written).toEqual(NOTHING_WRITTEN);
    expect(retried).toEqual(FIXTURE_COUNTS);
  });
});

describe("PE import command", () => {
  it("prints the same counts for the dry run and the import, then imports into the local profile's data directory", async () => {
    const file = await peDatabase();
    const database = await productDatabase();
    const dataDirectory = path.join(database.directory, "pglite");
    const config = configFor({
      DATA_DIRECTORY: dataDirectory,
      MIGRATIONS_PATH: MIGRATIONS,
    });

    const dryRun = await run(
      runPeImport(["--dry-run", path.relative(process.cwd(), file)]),
      config
    );
    const imported = await run(runPeImport([file]), config);
    const written = await run(tableCounts, database.layer);

    expect(dryRun).toBe(
      [
        `PE database: ${file}`,
        `Product database: ${dataDirectory}`,
        "Evaluations: 4",
        "Findings: 6",
        "Suggestions: 2",
        "Dry run: nothing was written.",
      ].join("\n")
    );
    expect(imported).toBe(
      [
        `PE database: ${file}`,
        `Product database: ${dataDirectory}`,
        "Evaluations: 4",
        "Findings: 6",
        "Suggestions: 2",
        "Imported for the local Learner as Rubric Version 1.",
      ].join("\n")
    );
    expect(written).toEqual({ ...FIXTURE_COUNTS, learners: 1 });
  });

  it("refuses the hosted profile before it opens a database", async () => {
    const file = await peDatabase();

    const refused = await run(
      refusal(runPeImport([file])),
      configFor({
        DATABASE_URL: "postgres://fluenshift@127.0.0.1:9/none",
        DEPLOY_PROFILE: "hosted",
      })
    );

    expect(refused).toBe(
      "PeImportError: PE's history belongs to the local profile, and DEPLOY_PROFILE names hosted"
    );
  });

  it("refuses arguments other than one PE database file and --dry-run", async () => {
    const file = await peDatabase();
    const config = configFor({
      DATA_DIRECTORY: path.join(await scratchDirectory(), "pglite"),
      MIGRATIONS_PATH: MIGRATIONS,
    });

    const refusals = await run(
      pipe(
        [[], ["--dry-run"], ["--force", file], [file, file]],
        Effect.forEach((args) => refusal(runPeImport(args)))
      ),
      config
    );

    expect(refusals).toEqual(
      Array.from(
        { length: 4 },
        () =>
          "PeImportError: usage: node dist/import-pe.mjs [--dry-run] <PE database file>"
      )
    );
  });

  it("reports a product database it cannot open, and imports nothing", async () => {
    const file = await peDatabase();
    const notADirectory = path.join(await scratchDirectory(), "pglite");
    await writeFile(notADirectory, "a file where the data directory goes");

    const refused = await run(
      refusal(runPeImport([file])),
      configFor({
        DATA_DIRECTORY: notADirectory,
        MIGRATIONS_PATH: MIGRATIONS,
      })
    );

    expect(refused).toBe(
      `PeImportError: the product database failed, so nothing was imported: EEXIST: file already exists, mkdir '${notADirectory}'`
    );
  });
});
