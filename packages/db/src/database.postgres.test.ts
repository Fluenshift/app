import { ServerConfig } from "@fluenshift/env";
import { sql } from "drizzle-orm";
import { Effect, Exit, Layer, Option, Redacted } from "effect";
import { describe, expect, it } from "vitest";

import { Database, DatabaseError } from "./database";

// This suite needs a Postgres server, so `pnpm test:postgres` runs it apart from the unit
// suites. It reads the server from the environment as the hosted profile does:
// DEPLOY_PROFILE=hosted and DATABASE_URL.
const hosted = Database.layer.pipe(Layer.provide(ServerConfig.layer));

describe("Database on Postgres", () => {
  it("opens the Postgres 17 server of the hosted profile", async () => {
    const result = await Effect.runPromise(
      Database.use((database) =>
        database.run((client) =>
          client.execute(
            sql`select inet_server_port() is not null as "overNetwork", current_setting('server_version_num')::int / 10000 as major, 1 + 1 as two`
          )
        )
      ).pipe(Effect.provide(hosted))
    );

    expect(result.rows).toStrictEqual([
      { major: 17, overNetwork: true, two: 2 },
    ]);
  });

  it("migrates the product tables on Postgres 17", async () => {
    const tables = await Effect.runPromise(
      Database.use((database) =>
        database.run((client) =>
          client.execute(
            sql`select table_name from information_schema.tables where table_schema = 'public' and table_name in ('evaluations', 'findings', 'learners', 'suggestions') order by table_name`
          )
        )
      ).pipe(Effect.provide(hosted))
    );

    expect(tables.rows).toStrictEqual([
      { table_name: "evaluations" },
      { table_name: "findings" },
      { table_name: "learners" },
      { table_name: "suggestions" },
    ]);
  });

  it("reports a rejected query as DatabaseError", async () => {
    const outcome = await Effect.runPromiseExit(
      Database.use((database) =>
        database.run((client) =>
          client.execute(sql`select * from missing_table`)
        )
      ).pipe(Effect.provide(hosted))
    );

    expect(Exit.isFailure(outcome)).toBe(true);
    expect(Option.getOrUndefined(Exit.findErrorOption(outcome))).toBeInstanceOf(
      DatabaseError
    );
  });

  it("reports connection startup failures as DatabaseError", async () => {
    const unreachable = Database.postgres({
      url: Redacted.make("postgres://postgres@127.0.0.1:1/postgres"),
    });
    const outcome = await Effect.runPromiseExit(
      Database.pipe(Effect.provide(unreachable))
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
          client.execute(sql`drop table if exists entries`)
        );
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
        yield* database.run((client) =>
          client.execute(sql`drop table entries`)
        );
        return { entries: entries.rows, failed };
      }).pipe(Effect.provide(hosted))
    );

    expect(Exit.isFailure(outcome.failed)).toBe(true);
    expect(
      Option.getOrUndefined(Exit.findErrorOption(outcome.failed))
    ).toBeInstanceOf(DatabaseError);
    expect(outcome.entries).toStrictEqual([{ value: "kept" }]);
  });
});
