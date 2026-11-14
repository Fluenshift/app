import { PGlite } from "@electric-sql/pglite";
import { ServerConfig } from "@fluenshift/env";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Context, Effect, Layer, Schema } from "effect";
import type { Redacted } from "effect";

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
            try: () => PGlite.create(options.dataDir),
            catch: (cause) => new DatabaseError({ cause }),
          }),
          (open) => Effect.promise(() => open.close())
        );
        return Database.of(serviceOf(drizzlePglite({ client: connection })));
      })
    );

  // Typed stubs for the red commit: both open an in-memory PGlite database, whatever the
  // deploy profile names.
  static readonly postgres = (_options: {
    readonly url: Redacted.Redacted<string>;
  }) => Database.pglite();

  static readonly layer = Layer.unwrap(
    Effect.gen(function* () {
      yield* ServerConfig;
      return Database.pglite();
    })
  );
}
