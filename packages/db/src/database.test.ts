import { readdirSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { assert, describe, expect, it } from "@effect/vitest";
import { ServerConfig } from "@grifando/env";
import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { ConfigProvider, Effect, Exit, Layer, Option } from "effect";
import { afterAll, beforeAll } from "vitest";

import { Database, DatabaseError } from "./database";
import {
  evaluationsView,
  findingsView,
  suggestionsView,
} from "./evaluation-views";
import { evaluations, findings, suggestions } from "./schema";

// Every data directory of this file lives under one scratch directory.
let scratch = "";

beforeAll(async () => {
  scratch = await mkdtemp(path.join(tmpdir(), "grifando-db-"));
});

afterAll(async () => {
  await rm(scratch, { force: true, recursive: true });
});

const MIGRATIONS = path.join(import.meta.dirname, "migrations");
// Every migration the product has, each applied once.
const MIGRATION_COUNT = readdirSync(MIGRATIONS).filter((file) =>
  file.endsWith(".sql")
).length;

// An in-memory database with the product schema.
const migrated = () => Database.pglite({ migrationsFolder: MIGRATIONS });

// The messages of an error and of the causes under it.
const messages = (value: unknown, depth = 0): string[] =>
  depth > 4 || !(value instanceof Error)
    ? []
    : [value.message, ...messages(value.cause, depth + 1)];

// Runs statements in order and answers what the database made of the last one: "accepted", or
// the name of the constraint that refused it.
const verdict = (statements: readonly SQL[]) =>
  Effect.gen(function* () {
    const database = yield* Database;
    const results = [];
    for (const statement of statements) {
      results.push(
        yield* Effect.exit(database.run((client) => client.execute(statement)))
      );
    }
    const last = results.at(-1);
    if (last === undefined || Exit.isSuccess(last)) {
      return "accepted";
    }
    const error = Option.getOrUndefined(Exit.findErrorOption(last));
    const message = messages(error?.cause).join("\n");
    return (
      /violates (?:check|foreign key|unique) constraint "(?<name>[^"]+)"/u.exec(
        message
      )?.groups?.["name"] ?? message
    );
  });

const learner = (id: string) => sql`insert into learners (id) values (${id})`;

const evaluation = (id: string, learnerId: string) =>
  sql`insert into evaluations (id, learner_id, origin, original_text, content_hash, corrected_text, summary, score, band, evaluated_english_word_count, rubric_version, provider, model, submitted_at, evaluated_at) values (${id}, ${learnerId}, 'work', 'Run the tset.', 'hash', 'Run the test.', 'One error.', 85, 'Natural', 3, '1', 'OpenRouter', 'openai/gpt-5.6-terra', now(), now())`;

const finding = (
  evaluationId: string,
  learnerId: string,
  values: {
    readonly byteEnd?: number;
    readonly byteStart?: number;
    readonly category?: string;
    readonly position?: number;
    readonly severity?: string;
  } = {}
) =>
  sql`insert into findings (learner_id, evaluation_id, position, byte_start, byte_end, category, severity, original_text, correction, explanation) values (${learnerId}, ${evaluationId}, ${values.position ?? 0}, ${values.byteStart ?? 8}, ${values.byteEnd ?? 12}, ${values.category ?? "Spelling"}, ${values.severity ?? "Minor"}, 'tset', 'test', 'The word is misspelled.')`;

const suggestion = (evaluationId: string, learnerId: string, position = 0) =>
  sql`insert into suggestions (learner_id, evaluation_id, position, byte_start, byte_end, original_text, alternative, explanation) values (${learnerId}, ${evaluationId}, ${position}, 0, 3, 'Run', 'Start', 'The original may be valid.')`;

// How many rows a table holds, or "failed" when the database cannot say.
const count = (table: "evaluations" | "findings" | "suggestions") =>
  Effect.gen(function* () {
    const database = yield* Database;
    const result = yield* Effect.exit(
      database.run((client) =>
        client.execute<{ count: number }>(
          sql`select count(*)::int as count from ${sql.identifier(table)}`
        )
      )
    );
    return Exit.isSuccess(result) ? result.value.rows[0]?.count : "failed";
  });

// The database of a deploy profile, from the environment the server would read.
const databaseOf = (env: Record<string, string>) =>
  Database.layer.pipe(
    Layer.provide(
      ServerConfig.layer.pipe(
        Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(env)))
      )
    )
  );

describe("Database", () => {
  it.effect("runs queries on an in-memory PGlite database", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      const result = yield* database.run((client) =>
        client.execute(sql`select 1 + 1 as two`)
      );
      assert.deepStrictEqual(result.rows, [{ two: 2 }]);
    }).pipe(Effect.provide(Database.pglite()))
  );

  it.effect("reports a rejected query as DatabaseError", () =>
    Effect.gen(function* () {
      const database = yield* Database;
      const exit = yield* Effect.exit(
        database.run((client) =>
          client.execute(sql`select * from missing_table`)
        )
      );
      assert.isTrue(Exit.isFailure(exit));
      if (Exit.isFailure(exit)) {
        const error = exit.cause.toString();
        assert.include(error, "DatabaseError");
      }
      assert.instanceOf(new DatabaseError({ cause: "x" }), DatabaseError);
    }).pipe(Effect.provide(Database.pglite()))
  );

  it("reports connection startup failures as DatabaseError", async () => {
    const brokenConfig = databaseOf({ DATA_DIRECTORY: "/dev/null/database" });
    const outcome = await Effect.runPromiseExit(
      Database.pipe(Effect.provide(brokenConfig))
    );

    expect(Exit.isFailure(outcome)).toBe(true);
    expect(Option.getOrUndefined(Exit.findErrorOption(outcome))).toBeInstanceOf(
      DatabaseError
    );
  });

  it("keeps the data of the local profile in its data directory", async () => {
    const local = databaseOf({ DATA_DIRECTORY: path.join(scratch, "kept") });
    await Effect.runPromise(
      Database.use((database) =>
        database.run((client) =>
          client.execute(
            sql`create table kept as select 'still here'::text as value`
          )
        )
      ).pipe(Effect.provide(local))
    );
    const reopened = await Effect.runPromise(
      Database.use((database) =>
        database.run((client) => client.execute(sql`select value from kept`))
      ).pipe(Effect.provide(local))
    );

    expect(reopened.rows).toStrictEqual([{ value: "still here" }]);
  });

  it("creates the data directory of the local profile with its missing parents", async () => {
    const nested = path.join(scratch, "not", "yet", "there");
    const result = await Effect.runPromise(
      Database.use((database) =>
        database.run((client) => client.execute(sql`select 1 + 1 as two`))
      ).pipe(Effect.provide(databaseOf({ DATA_DIRECTORY: nested })))
    );

    expect(result.rows).toStrictEqual([{ two: 2 }]);
  });

  it("migrates product tables and enforces their foreign keys and constraints", async () => {
    const outcome = await Effect.runPromise(
      Effect.gen(function* () {
        const database = yield* Database;
        const tables = yield* database.run((client) =>
          client.execute(
            sql`select table_name from information_schema.tables where table_schema = 'public' and table_name in ('evaluations', 'findings', 'learners', 'suggestions') order by table_name`
          )
        );
        const deleteRules = yield* database.run((client) =>
          client.execute(
            sql`select constraints.table_name, rules.delete_rule from information_schema.referential_constraints rules join information_schema.table_constraints constraints on constraints.constraint_name = rules.constraint_name and constraints.constraint_schema = rules.constraint_schema where constraints.table_schema = 'public' and constraints.table_name in ('evaluations', 'findings', 'suggestions') order by constraints.table_name`
          )
        );
        const refused = yield* verdict([
          learner("learner-1"),
          evaluation("evaluation-1", "learner-1"),
          finding("evaluation-1", "learner-1", { category: "Style" }),
        ]);
        yield* verdict([
          finding("evaluation-1", "learner-1"),
          suggestion("evaluation-1", "learner-1"),
        ]);
        const kept = [
          yield* count("evaluations"),
          yield* count("findings"),
          yield* count("suggestions"),
        ];
        yield* verdict([sql`delete from learners where id = 'learner-1'`]);
        const removed = [
          yield* count("evaluations"),
          yield* count("findings"),
          yield* count("suggestions"),
        ];
        return {
          deleteRules: deleteRules.rows,
          kept,
          refused,
          removed,
          tables: tables.rows,
        };
      }).pipe(Effect.provide(migrated()))
    );

    expect(outcome.tables).toStrictEqual([
      { table_name: "evaluations" },
      { table_name: "findings" },
      { table_name: "learners" },
      { table_name: "suggestions" },
    ]);
    expect(outcome.deleteRules).toStrictEqual([
      { delete_rule: "CASCADE", table_name: "evaluations" },
      { delete_rule: "CASCADE", table_name: "findings" },
      { delete_rule: "CASCADE", table_name: "suggestions" },
    ]);
    expect(outcome.refused).toBe("findings_category_check");
    expect(outcome.kept).toStrictEqual([1, 1, 1]);
    expect(outcome.removed).toStrictEqual([0, 0, 0]);
  });

  // A feature that leaves the product takes its table with it (ADR 0046): the migrations end on
  // exactly these tables.
  it("migrates exactly the product's tables", async () => {
    const tables = await Effect.runPromise(
      Effect.gen(function* () {
        const database = yield* Database;
        return yield* database.run((client) =>
          client.execute(
            sql`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`
          )
        );
      }).pipe(Effect.provide(migrated()))
    );

    expect(tables.rows).toStrictEqual([
      { table_name: "category_abilities" },
      { table_name: "enrichments" },
      { table_name: "evaluations" },
      { table_name: "exercise_attempts" },
      { table_name: "exercises" },
      { table_name: "findings" },
      { table_name: "interview_sessions" },
      { table_name: "interview_turns" },
      { table_name: "learners" },
      { table_name: "mistake_patterns" },
      { table_name: "occurrences" },
      { table_name: "rate_limit_windows" },
      { table_name: "suggestions" },
      { table_name: "vocabulary_items" },
    ]);
  });

  it("ties every Finding and Suggestion to the Learner of its Evaluation", async () => {
    const outcome = await Effect.runPromise(
      Effect.gen(function* () {
        yield* verdict([
          learner("learner-1"),
          learner("learner-2"),
          evaluation("evaluation-1", "learner-1"),
        ]);
        return [
          yield* verdict([finding("evaluation-1", "learner-2")]),
          yield* verdict([suggestion("evaluation-1", "learner-2")]),
          yield* verdict([evaluation("evaluation-2", "nobody")]),
        ];
      }).pipe(Effect.provide(migrated()))
    );

    expect(outcome).toStrictEqual([
      "findings_evaluation_fk",
      "suggestions_evaluation_fk",
      "evaluations_learner_fk",
    ]);
  });

  it("refuses values outside the closed sets, scores outside 0 to 100 and empty byte spans", async () => {
    const setup = [
      learner("learner-1"),
      evaluation("evaluation-1", "learner-1"),
    ];
    const outcome = await Effect.runPromise(
      Effect.gen(function* () {
        yield* verdict(setup);
        return [
          yield* verdict([
            finding("evaluation-1", "learner-1", { severity: "Critical" }),
          ]),
          yield* verdict([
            finding("evaluation-1", "learner-1", { byteEnd: 8, byteStart: 8 }),
          ]),
          yield* verdict([
            finding("evaluation-1", "learner-1", { byteEnd: 2, byteStart: -1 }),
          ]),
          yield* verdict([
            sql`update evaluations set band = 'Fluent' where id = 'evaluation-1'`,
          ]),
          yield* verdict([
            sql`update evaluations set score = 101 where id = 'evaluation-1'`,
          ]),
          yield* verdict([
            sql`update evaluations set origin = 'draft' where id = 'evaluation-1'`,
          ]),
          yield* verdict([
            sql`update evaluations set origin = 'practice', score = 0, band = 'Needs revision' where id = 'evaluation-1'`,
          ]),
        ];
      }).pipe(Effect.provide(migrated()))
    );

    expect(outcome).toStrictEqual([
      "findings_severity_check",
      "findings_byte_span_check",
      "findings_byte_span_check",
      "evaluations_band_check",
      "evaluations_score_check",
      "evaluations_origin_check",
      "accepted",
    ]);
  });

  it("keeps one Finding and one Suggestion per position of an Evaluation", async () => {
    const outcome = await Effect.runPromise(
      Effect.gen(function* () {
        yield* verdict([
          learner("learner-1"),
          evaluation("evaluation-1", "learner-1"),
          finding("evaluation-1", "learner-1"),
          suggestion("evaluation-1", "learner-1"),
        ]);
        return [
          yield* verdict([finding("evaluation-1", "learner-1")]),
          yield* verdict([suggestion("evaluation-1", "learner-1")]),
          yield* verdict([
            finding("evaluation-1", "learner-1", { position: 1 }),
          ]),
        ];
      }).pipe(Effect.provide(migrated()))
    );

    expect(outcome).toStrictEqual([
      "findings_evaluation_position_unique",
      "suggestions_evaluation_position_unique",
      "accepted",
    ]);
  });

  it("orders the Evaluations of one moment by their insertion", async () => {
    const order = await Effect.runPromise(
      Effect.gen(function* () {
        const database = yield* Database;
        yield* verdict([
          learner("learner-1"),
          evaluation("first", "learner-1"),
          evaluation("second", "learner-1"),
          sql`update evaluations set evaluated_at = '2026-09-07T12:00:00.000Z'`,
        ]);
        return yield* database
          .run((client) =>
            client.execute(
              sql`select id from evaluations order by evaluated_at desc, insertion_order desc`
            )
          )
          .pipe(
            Effect.map((result) => result.rows),
            Effect.orElseSucceed(() => [])
          );
      }).pipe(Effect.provide(migrated()))
    );

    expect(order).toStrictEqual([{ id: "second" }, { id: "first" }]);
  });

  it("reopens a migrated data directory without migrating it again", async () => {
    const directory = path.join(scratch, "migrated");
    const open = Database.pglite({
      dataDir: directory,
      migrationsFolder: MIGRATIONS,
    });
    await Effect.runPromise(
      verdict([learner("learner-1")]).pipe(Effect.provide(open))
    );
    const reopened = await Effect.runPromise(
      Database.use((database) =>
        database.run((client) =>
          client.execute(
            sql`select (select count(*)::int from learners) as learners, (select count(*)::int from drizzle.__drizzle_migrations) as migrations`
          )
        )
      ).pipe(Effect.provide(open))
    );

    expect(reopened.rows).toStrictEqual([
      { learners: 1, migrations: MIGRATION_COUNT },
    ]);
  });

  it("applies the migrations of MIGRATIONS_PATH to the database of the local profile", async () => {
    const tables = await Effect.runPromise(
      Effect.gen(function* () {
        const database = yield* Database;
        return yield* database.run((client) =>
          client.execute(
            sql`select table_name from information_schema.tables where table_schema = 'public' and table_name in ('evaluations', 'findings', 'learners', 'suggestions') order by table_name`
          )
        );
      }).pipe(
        Effect.provide(
          databaseOf({
            DATA_DIRECTORY: path.join(scratch, "profile"),
            MIGRATIONS_PATH: MIGRATIONS,
          })
        )
      )
    );

    expect(tables.rows).toStrictEqual([
      { table_name: "evaluations" },
      { table_name: "findings" },
      { table_name: "learners" },
      { table_name: "suggestions" },
    ]);
  });

  it("reports migrations it cannot read as DatabaseError", async () => {
    const outcome = await Effect.runPromiseExit(
      Database.pipe(
        Effect.provide(
          Database.pglite({
            migrationsFolder: path.join(scratch, "no-migrations-here"),
          })
        )
      )
    );

    expect(Exit.isFailure(outcome)).toBe(true);
    expect(Option.getOrUndefined(Exit.findErrorOption(outcome))).toBeInstanceOf(
      DatabaseError
    );
  });

  it("rolls a failed transaction back and keeps a completed one", async () => {
    const outcome = await Effect.runPromise(
      Effect.gen(function* () {
        const database = yield* Database;
        yield* database.run((client) =>
          client.execute(sql`create table entries (value text)`)
        );
        const failed = yield* Effect.exit(
          database.run((client) =>
            client.transaction((transaction) =>
              transaction
                .execute(sql`insert into entries values ('rolled back')`)
                .then(() => transaction.execute(sql`select * from missing`))
            )
          )
        );
        yield* database.run((client) =>
          client.transaction((transaction) =>
            transaction.execute(sql`insert into entries values ('kept')`)
          )
        );
        const entries = yield* database.run((client) =>
          client.execute(sql`select value from entries`)
        );
        return { entries: entries.rows, failed };
      }).pipe(Effect.provide(Database.pglite()))
    );

    expect(Exit.isFailure(outcome.failed)).toBe(true);
    expect(
      Option.getOrUndefined(Exit.findErrorOption(outcome.failed))
    ).toBeInstanceOf(DatabaseError);
    expect(outcome.entries).toStrictEqual([{ value: "kept" }]);
  });

  it("reads the Evaluation tables whole through their read-only views", async () => {
    const read = await Effect.runPromise(
      Effect.gen(function* () {
        const database = yield* Database;
        yield* verdict([
          learner("learner-1"),
          evaluation("evaluation-1", "learner-1"),
          finding("evaluation-1", "learner-1"),
          suggestion("evaluation-1", "learner-1"),
        ]);
        return yield* database.run((client) =>
          Promise.all([
            client.select().from(evaluations),
            client.select().from(findings),
            client.select().from(suggestions),
            client.select().from(evaluationsView),
            client.select().from(findingsView),
            client.select().from(suggestionsView),
          ]).then(
            ([evaluationRows, findingRows, suggestionRows, ...views]) => ({
              tables: {
                evaluation: evaluationRows,
                finding: findingRows,
                suggestion: suggestionRows,
              },
              views,
            })
          )
        );
      }).pipe(Effect.provide(migrated()))
    );

    expect(
      [read.tables.evaluation, read.tables.finding, read.tables.suggestion].map(
        (rows) => rows.length
      )
    ).toStrictEqual([1, 1, 1]);
    expect(read.views).toStrictEqual([
      read.tables.evaluation,
      read.tables.finding,
      read.tables.suggestion,
    ]);
  });
});
