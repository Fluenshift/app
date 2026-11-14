import { mkdir } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { ServerConfig } from "@fluenshift/env";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Context, Effect, Layer, Redacted, Schema } from "effect";
import { Pool } from "pg";

/** What a raw query answers on either driver: its rows. */
export interface Rows<Row> {
  readonly rows: Row[];
}

export interface RowsResultHKT extends PgQueryResultHKT {
  readonly type: Rows<this["row"]>;
}

/** The Drizzle client both drivers satisfy: PGlite and node-postgres. */
export type DrizzleClient = PgDatabase<RowsResultHKT>;

export class DatabaseError extends Schema.TaggedError<
  DatabaseError,
  { readonly brand: unique symbol }
>()("DatabaseError", {
  cause: Schema.Defect(),
}) {}

// PGlite creates its data directory but none of the directories above it. The resolved path
// also keeps a value such as `memory://` a directory: local data never lands in memory.
const openPglite = (dataDir: string | undefined) => {
  if (dataDir === undefined) {
    return PGlite.create();
  }
  const directory = path.resolve(dataDir);
  return mkdir(directory, { recursive: true }).then(() =>
    PGlite.create(directory)
  );
};

const serviceOf = (client: DrizzleClient) => ({
  run: Effect.fn("Database.run")(
    <A>(query: (client: DrizzleClient) => Promise<A>) =>
      Effect.tryPromise({
        try: () => query(client),
        catch: (cause) => new DatabaseError({ cause }),
      })
  ),
});

/**
 * Drizzle is the query vocabulary; this service owns the connection lifecycle and turns
 * rejected queries into a typed `DatabaseError`. The deploy profile chooses the driver: PGlite
 * in a data directory locally, Postgres when hosted (docs/adr/0003, docs/adr/0017).
 */
export class Database extends Context.Service<
  Database,
  {
    run<A>(
      query: (client: DrizzleClient) => Promise<A>
    ): Effect.Effect<A, DatabaseError>;
  }
>()("@fluenshift/db/Database") {
  /** An embedded PGlite database: in memory without `dataDir`, on disk with it. */
  static readonly pglite = (options: { readonly dataDir?: string } = {}) =>
    Layer.effect(
      Database,
      Effect.gen(function* () {
        const connection = yield* Effect.acquireRelease(
          Effect.tryPromise({
            try: () => openPglite(options.dataDir),
            catch: (cause) => new DatabaseError({ cause }),
          }),
          (open) => Effect.promise(() => open.close())
        );
        return Database.of(serviceOf(drizzlePglite({ client: connection })));
      })
    );

  /** A pool of connections to a Postgres server. */
  static readonly postgres = (options: {
    readonly url: Redacted.Redacted<string>;
  }) =>
    Layer.effect(
      Database,
      Effect.gen(function* () {
        const pool = yield* Effect.acquireRelease(
          Effect.sync(
            () => new Pool({ connectionString: Redacted.value(options.url) })
          ),
          (open) => Effect.promise(() => open.end())
        );
        // A pool connects on its first query: ask now, so a wrong address fails at startup.
        yield* Effect.tryPromise({
          try: () => pool.query("select 1"),
          catch: (cause) => new DatabaseError({ cause }),
        });
        return Database.of(serviceOf(drizzlePostgres({ client: pool })));
      })
    );

  /** The database of the deploy profile, as `ServerConfig` names it. */
  static readonly layer = Layer.unwrap(
    Effect.gen(function* () {
      const { database } = yield* ServerConfig;
      return database.kind === "postgres"
        ? Database.postgres({ url: database.url })
        : Database.pglite({ dataDir: database.dataDirectory });
    })
  );
}
