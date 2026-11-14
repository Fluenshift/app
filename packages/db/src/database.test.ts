import { assert, describe, it } from "@effect/vitest";
import { sql } from "drizzle-orm";
import { Effect, Exit } from "effect";

import { Database, DatabaseError } from "./database";

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
});
