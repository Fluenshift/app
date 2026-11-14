import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { assert, describe, expect, it } from "@effect/vitest";
import { ServerConfig } from "@fluenshift/env";
import { sql } from "drizzle-orm";
import { ConfigProvider, Effect, Exit, Layer, Option } from "effect";
import { afterAll, beforeAll } from "vitest";

import { Database, DatabaseError } from "./database";

// Every data directory of this file lives under one scratch directory.
let scratch = "";

beforeAll(async () => {
  scratch = await mkdtemp(path.join(tmpdir(), "fluenshift-db-"));
});

afterAll(async () => {
  await rm(scratch, { force: true, recursive: true });
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
});
