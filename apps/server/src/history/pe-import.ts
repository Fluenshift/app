// The one-time import of PE's local Learning History into the product (docs/adr/0018, decision
// 2). PE kept one Learner's Evaluations in a SQLite file, scored under Rubric Version 1 (PE
// packages/db/src/schema/index.ts, 5e831bb). The import reads that file with Node's own SQLite,
// checks every row against what the product stores, then copies each Evaluation with its Findings
// and Suggestions for the local Learner, in PE's insertion order and in one transaction, so a
// failure imports nothing. A dry run reads and checks the same way and writes nothing. Both report
// the same counts, and the import is accepted only when they match. The import records itself in
// the same transaction, and a run refuses once an import is recorded, or while the product holds
// any Evaluation of the file: the history is never imported twice, even after the Learner deleted
// what an import wrote.
//
// The import copies and runs no model: the Academy folds none of the imported Evaluations, and
// Progress keeps them in Rubric Version 1's own segment, apart from the provisional version.
// `src/import-pe.ts` runs it from the command line.
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { SQLOutputValue } from "node:sqlite";
import { parseArgs } from "node:util";

import {
  ErrorCategory,
  FindingSeverity,
  ProficiencyBand,
} from "@fluenshift/contract";
import { RUBRIC_VERSION } from "@fluenshift/core/rubric-v1";
import {
  Database,
  evaluations,
  findings,
  learners,
  peImports,
  suggestions,
} from "@fluenshift/db";
import type { DatabaseError, DrizzleClient } from "@fluenshift/db";
import { ServerConfig } from "@fluenshift/env";
import { eq } from "drizzle-orm";
import { Effect, Predicate, Result, Schema, SchemaIssue } from "effect";

import { LOCAL_LEARNER_ID } from "../learner-identity";

/** Why an import read, checked or wrote nothing. */
export class PeImportError extends Schema.TaggedError<
  PeImportError,
  { readonly brand: unique symbol }
>()("PeImportError", { message: Schema.String }) {}

/** What an import writes, or what a dry run would write. */
export interface PeImportCounts {
  readonly evaluations: number;
  readonly findings: number;
  readonly suggestions: number;
}

const NUL = String.fromCodePoint(0);

// Text the product can store: Postgres refuses the NUL character, which SQLite keeps.
const StoredText = Schema.String.check(
  Schema.makeFilter((text: string) => !text.includes(NUL), {
    expected: "text without a NUL character",
  })
);

// A count that fits the product's integer columns.
const StoredCount = Schema.Natural.check(Schema.isInt32());

// An instant as PE wrote it, with Date.prototype.toISOString: the product keeps it to the
// millisecond, so Learning History shows the same text.
const Instant = Schema.String.check(
  Schema.makeFilter(
    (text: string) => {
      const time = Date.parse(text);
      return !Number.isNaN(time) && new Date(time).toISOString() === text;
    },
    { expected: "an instant as Date.prototype.toISOString writes it" }
  )
);

const Score = Schema.Int.check(Schema.isBetween({ maximum: 100, minimum: 0 }));

// The product keeps a span only when it holds at least one byte.
const nonEmptySpan = Schema.makeFilter(
  (row: { readonly byte_end: number; readonly byte_start: number }) =>
    row.byte_end > row.byte_start || {
      issue: "an empty span",
      path: ["byte_end"],
    }
);

const PeEvaluation = Schema.Struct({
  band: ProficiencyBand,
  content_hash: StoredText,
  corrected_text: StoredText,
  evaluated_at: Instant,
  evaluated_english_word_count: StoredCount,
  id: StoredText,
  input_tokens: Schema.NullOr(StoredCount),
  latency_milliseconds: Schema.NullOr(StoredCount),
  model: StoredText,
  original_text: StoredText,
  output_tokens: Schema.NullOr(StoredCount),
  provider: StoredText,
  rubric_version: Schema.Literal(RUBRIC_VERSION),
  score: Score,
  submitted_at: Instant,
  summary: StoredText,
});
type PeEvaluation = typeof PeEvaluation.Type;

const PeFinding = Schema.Struct({
  byte_end: StoredCount,
  byte_start: StoredCount,
  category: ErrorCategory,
  correction: StoredText,
  evaluation_id: StoredText,
  explanation: StoredText,
  original_text: StoredText,
  position: StoredCount,
  severity: FindingSeverity,
}).check(nonEmptySpan);
type PeFinding = typeof PeFinding.Type;

const PeSuggestion = Schema.Struct({
  alternative: Schema.NullOr(StoredText),
  byte_end: StoredCount,
  byte_start: StoredCount,
  evaluation_id: StoredText,
  explanation: StoredText,
  original_text: StoredText,
  position: StoredCount,
}).check(nonEmptySpan);
type PeSuggestion = typeof PeSuggestion.Type;

type PeRow = Record<string, SQLOutputValue>;

interface PeRows {
  readonly evaluations: readonly PeRow[];
  readonly findings: readonly PeRow[];
  readonly suggestions: readonly PeRow[];
}

/** One PE Evaluation, checked, with its Findings and Suggestions. */
interface PeHistoryEntry {
  readonly evaluation: PeEvaluation;
  readonly findings: readonly PeFinding[];
  readonly suggestions: readonly PeSuggestion[];
}

// Drizzle's message carries a failed query's parameters, the Learner's text among them; the
// driver's or the file system's error beneath it names what failed.
const innermostMessage = (cause: unknown): string => {
  if (Predicate.hasProperty(cause, "cause") && cause.cause !== undefined) {
    return innermostMessage(cause.cause);
  }
  return Predicate.isError(cause) ? cause.message : String(cause);
};

const unreadable = (file: string, cause: unknown) =>
  new PeImportError({
    message: `cannot read a PE database at ${file}: ${innermostMessage(cause)}`,
  });

const databaseFailure = (error: DatabaseError) =>
  new PeImportError({
    message: `the product database failed, so nothing was imported: ${innermostMessage(error.cause)}`,
  });

const readRows = (pe: DatabaseSync): PeRows => ({
  evaluations: pe
    .prepare(
      "select rowid, id, original_text, content_hash, submitted_at, evaluated_at, corrected_text, summary, score, band, evaluated_english_word_count, provider, model, rubric_version, input_tokens, output_tokens, latency_milliseconds from evaluations order by rowid"
    )
    .all(),
  findings: pe
    .prepare(
      "select id, evaluation_id, position, byte_start, byte_end, original_text, correction, category, severity, explanation from findings order by id"
    )
    .all(),
  suggestions: pe
    .prepare(
      "select id, evaluation_id, position, byte_start, byte_end, original_text, alternative, explanation from suggestions order by id"
    )
    .all(),
});

// Read-only: the import never changes PE's file.
const readPeRows = Effect.fn("PeImport.readPeRows")(function* (file: string) {
  const pe = yield* Effect.acquireRelease(
    Effect.try({
      try: () => new DatabaseSync(file, { readOnly: true }),
      catch: (cause) => unreadable(file, cause),
    }),
    (opened) => Effect.sync(() => opened.close())
  );
  return yield* Effect.try({
    try: () => readRows(pe),
    catch: (cause) => unreadable(file, cause),
  });
}, Effect.scoped);

/** A row as the import checked it: its value, or the columns the product would refuse. */
interface RowCheck<A> {
  readonly columns: readonly string[];
  readonly label: string;
  readonly value: A | undefined;
}

const formatIssues = SchemaIssue.makeFormatterStandardSchemaV1();

// The columns of a row that fail, by name and never by value, since a value may be the Learner's
// text. Each row schema declares its columns in alphabetical order, which the report keeps.
const failedColumns = (issue: SchemaIssue.Issue) => [
  ...new Set(
    formatIssues(issue).issues.map(({ path: [column] = [] }) => String(column))
  ),
];

const checkRows = <A>(
  rows: readonly PeRow[],
  decode: (row: PeRow) => Result.Result<A, Schema.SchemaError>,
  label: (row: PeRow) => string
) =>
  rows.map((row): RowCheck<A> => {
    const decoded = decode(row);
    return Result.isSuccess(decoded)
      ? { columns: [], label: label(row), value: decoded.success }
      : {
          columns: failedColumns(decoded.failure.issue),
          label: label(row),
          value: undefined,
        };
  });

// A Finding or a Suggestion belongs to an Evaluation of the file, and holds a position of its
// own there: the product keeps one row per position of an Evaluation.
const checkPlacement = <
  A extends { readonly evaluation_id: string; readonly position: number },
>(
  checks: readonly RowCheck<A>[],
  evaluationIds: ReadonlySet<string>
) => {
  const taken = new Set<string>();
  return checks.map((check): RowCheck<A> => {
    if (check.value === undefined) {
      return check;
    }
    const place = JSON.stringify([
      check.value.evaluation_id,
      check.value.position,
    ]);
    const columns = [
      ...(evaluationIds.has(check.value.evaluation_id)
        ? []
        : ["evaluation_id"]),
      ...(taken.has(place) ? ["position"] : []),
    ];
    taken.add(place);
    return columns.length === 0
      ? check
      : { columns, label: check.label, value: undefined };
  });
};

const valuesOf = <A>(checks: readonly RowCheck<A>[]) =>
  checks.flatMap((check) => (check.value === undefined ? [] : [check.value]));

const decodeEvaluation = Schema.decodeUnknownResult(PeEvaluation, {
  errors: "all",
});
const decodeFinding = Schema.decodeUnknownResult(PeFinding, { errors: "all" });
const decodeSuggestion = Schema.decodeUnknownResult(PeSuggestion, {
  errors: "all",
});

// Every row of a PE database, checked against what the product stores, as the entries to import
// in PE's insertion order; or the rows that do not fit, each named by its table, its key in PE
// and its failing columns.
const readPeHistory = Effect.fn("PeImport.readPeHistory")(function* (
  file: string
) {
  const rows = yield* readPeRows(file);
  const evaluationIds = new Set(rows.evaluations.map((row) => String(row.id)));
  const evaluationChecks = checkRows(
    rows.evaluations,
    decodeEvaluation,
    (row) => `evaluations row ${String(row.rowid)}`
  );
  const findingChecks = checkPlacement(
    checkRows(
      rows.findings,
      decodeFinding,
      (row) => `findings row ${String(row.id)}`
    ),
    evaluationIds
  );
  const suggestionChecks = checkPlacement(
    checkRows(
      rows.suggestions,
      decodeSuggestion,
      (row) => `suggestions row ${String(row.id)}`
    ),
    evaluationIds
  );
  const problems = [
    ...evaluationChecks,
    ...findingChecks,
    ...suggestionChecks,
  ].flatMap((check) =>
    check.columns.length === 0
      ? []
      : [`${check.label}: ${check.columns.join(", ")}`]
  );
  if (problems.length > 0) {
    return yield* new PeImportError({
      message: [
        "rows of this PE database that do not fit the product:",
        ...problems,
      ].join("\n"),
    });
  }
  const findingsOf = Map.groupBy(
    valuesOf(findingChecks),
    (finding) => finding.evaluation_id
  );
  const suggestionsOf = Map.groupBy(
    valuesOf(suggestionChecks),
    (suggestion) => suggestion.evaluation_id
  );
  return valuesOf(evaluationChecks).map((evaluation): PeHistoryEntry => ({
    evaluation,
    findings: findingsOf.get(evaluation.id) ?? [],
    suggestions: suggestionsOf.get(evaluation.id) ?? [],
  }));
});

const countsOf = (history: readonly PeHistoryEntry[]): PeImportCounts => ({
  evaluations: history.length,
  findings: history.reduce((total, entry) => total + entry.findings.length, 0),
  suggestions: history.reduce(
    (total, entry) => total + entry.suggestions.length,
    0
  ),
});

// How many of the file's Evaluations the product holds already, for any Learner: an Evaluation
// ID is unique across the product.
const heldCount = (
  client: DrizzleClient,
  history: readonly PeHistoryEntry[]
) => {
  const ids = new Set(history.map(({ evaluation }) => evaluation.id));
  return client
    .select({ id: evaluations.id })
    .from(evaluations)
    .then((rows) => rows.filter((row) => ids.has(row.id)).length);
};

// The IDs of the rows an insert wrote, as the product answers them.
type WrittenRows = Promise<readonly { readonly id: number }[]>;

// What an earlier import of a PE database wrote for the local Learner, if one ran.
const previousImport = (client: DrizzleClient) =>
  client
    .select({
      evaluations: peImports.evaluationCount,
      findings: peImports.findingCount,
      suggestions: peImports.suggestionCount,
    })
    .from(peImports)
    .where(eq(peImports.learnerId, LOCAL_LEARNER_ID))
    .then(([row]) => row);

const insertFindings = (
  client: DrizzleClient,
  rows: readonly PeFinding[]
): WrittenRows =>
  rows.length === 0
    ? Promise.resolve([])
    : client
        .insert(findings)
        .values(
          rows.map((finding) => ({
            byteEnd: finding.byte_end,
            byteStart: finding.byte_start,
            category: finding.category,
            correction: finding.correction,
            evaluationId: finding.evaluation_id,
            explanation: finding.explanation,
            learnerId: LOCAL_LEARNER_ID,
            originalText: finding.original_text,
            position: finding.position,
            severity: finding.severity,
          }))
        )
        .returning({ id: findings.id });

const insertSuggestions = (
  client: DrizzleClient,
  rows: readonly PeSuggestion[]
): WrittenRows =>
  rows.length === 0
    ? Promise.resolve([])
    : client
        .insert(suggestions)
        .values(
          rows.map((suggestion) => ({
            alternative: suggestion.alternative,
            byteEnd: suggestion.byte_end,
            byteStart: suggestion.byte_start,
            evaluationId: suggestion.evaluation_id,
            explanation: suggestion.explanation,
            learnerId: LOCAL_LEARNER_ID,
            originalText: suggestion.original_text,
            position: suggestion.position,
          }))
        )
        .returning({ id: suggestions.id });

// One Evaluation with its Findings and Suggestions, as a work Writing Sample of the local Learner;
// the counts are the rows the product answers it wrote.
const writeEntry = (
  client: DrizzleClient,
  { evaluation, ...entry }: PeHistoryEntry
): Promise<PeImportCounts> =>
  client
    .insert(evaluations)
    .values({
      band: evaluation.band,
      contentHash: evaluation.content_hash,
      correctedText: evaluation.corrected_text,
      evaluatedAt: new Date(evaluation.evaluated_at),
      evaluatedEnglishWordCount: evaluation.evaluated_english_word_count,
      id: evaluation.id,
      inputTokens: evaluation.input_tokens,
      latencyMilliseconds: evaluation.latency_milliseconds,
      learnerId: LOCAL_LEARNER_ID,
      model: evaluation.model,
      origin: "work",
      originalText: evaluation.original_text,
      outputTokens: evaluation.output_tokens,
      provider: evaluation.provider,
      rubricVersion: evaluation.rubric_version,
      score: evaluation.score,
      submittedAt: new Date(evaluation.submitted_at),
      summary: evaluation.summary,
    })
    .returning({ id: evaluations.id })
    .then((evaluationRows) =>
      Promise.all([
        evaluationRows,
        insertFindings(client, entry.findings),
        insertSuggestions(client, entry.suggestions),
      ] as const)
    )
    .then(([evaluationRows, findingRows, suggestionRows]) => ({
      evaluations: evaluationRows.length,
      findings: findingRows.length,
      suggestions: suggestionRows.length,
    }));

// The entries one after the other: the product's insertion order then follows PE's, which breaks
// History's ties between Evaluations of one moment.
const writeFrom = (
  client: DrizzleClient,
  history: readonly PeHistoryEntry[],
  index: number,
  written: PeImportCounts
): Promise<PeImportCounts> => {
  const entry = history[index];
  if (entry === undefined) {
    return Promise.resolve(written);
  }
  return writeEntry(client, entry).then((counts) =>
    writeFrom(client, history, index + 1, {
      evaluations: written.evaluations + counts.evaluations,
      findings: written.findings + counts.findings,
      suggestions: written.suggestions + counts.suggestions,
    })
  );
};

const writeHistory = (
  client: DrizzleClient,
  history: readonly PeHistoryEntry[]
) =>
  client.transaction((transaction) =>
    transaction
      .insert(learners)
      .values({ id: LOCAL_LEARNER_ID })
      .onConflictDoNothing()
      .then(() =>
        writeFrom(transaction, history, 0, {
          evaluations: 0,
          findings: 0,
          suggestions: 0,
        })
      )
      // The record of this import, so that no later run imports the history again.
      .then((written) =>
        Promise.all([
          written,
          transaction.insert(peImports).values({
            evaluationCount: written.evaluations,
            findingCount: written.findings,
            learnerId: LOCAL_LEARNER_ID,
            suggestionCount: written.suggestions,
          }),
        ] as const)
      )
      .then(([written]) => written)
  );

/**
 * Imports the PE database in `file` for the local Learner, or, as a dry run, reads and checks it
 * and writes nothing. Either way it answers the counts of what it writes.
 */
export const importPeHistory = Effect.fn("PeImport.importPeHistory")(
  function* (file: string, options: { readonly dryRun: boolean }) {
    const history = yield* readPeHistory(file);
    const database = yield* Database;
    const held = yield* database.run((client) => heldCount(client, history));
    if (held > 0) {
      return yield* new PeImportError({
        message: `the product already holds ${held} of the ${history.length} Evaluations of this PE database: the import ran before`,
      });
    }
    const previous = yield* database.run(previousImport);
    if (previous !== undefined) {
      return yield* new PeImportError({
        message: `the product imported a PE database before (${previous.evaluations} Evaluations, ${previous.findings} Findings and ${previous.suggestions} Suggestions): the import runs once`,
      });
    }
    if (options.dryRun) {
      return countsOf(history);
    }
    return yield* database.run((client) => writeHistory(client, history));
  },
  Effect.catchTag("DatabaseError", (failure) =>
    Effect.fail(databaseFailure(failure))
  )
);

const USAGE = "usage: node dist/import-pe.mjs [--dry-run] <PE database file>";

const importArguments = Effect.fn("PeImport.importArguments")(function* (
  args: readonly string[]
) {
  const {
    positionals: [file, ...others],
    values,
  } = yield* Effect.try({
    try: () =>
      parseArgs({
        allowPositionals: true,
        args: [...args],
        options: { "dry-run": { default: false, type: "boolean" } },
        strict: true,
      }),
    catch: () => new PeImportError({ message: USAGE }),
  });
  if (file === undefined || others.length > 0) {
    return yield* new PeImportError({ message: USAGE });
  }
  return { dryRun: values["dry-run"], file: path.resolve(file) };
});

/**
 * The import command: one PE database file, and `--dry-run` to check it and write nothing. It
 * opens the local profile's database as the server does, and answers what to print.
 */
export const runPeImport = Effect.fn("PeImport.runPeImport")(function* (
  args: readonly string[]
) {
  const { dryRun, file } = yield* importArguments(args);
  const { database } = yield* ServerConfig;
  if (database.kind === "postgres") {
    return yield* new PeImportError({
      message:
        "PE's history belongs to the local profile, and DEPLOY_PROFILE names hosted",
    });
  }
  const counts = yield* importPeHistory(file, { dryRun }).pipe(
    Effect.provide(Database.layer),
    Effect.catchTag("DatabaseError", (failure) =>
      Effect.fail(databaseFailure(failure))
    )
  );
  return [
    `PE database: ${file}`,
    `Product database: ${path.resolve(database.dataDirectory)}`,
    `Evaluations: ${counts.evaluations}`,
    `Findings: ${counts.findings}`,
    `Suggestions: ${counts.suggestions}`,
    dryRun
      ? "Dry run: nothing was written."
      : "Imported for the local Learner as Rubric Version 1.",
  ].join("\n");
});
