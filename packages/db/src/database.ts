import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { Context, Effect, Layer, Schema } from "effect";

export type DrizzleClient = PgliteDatabase;

export class DatabaseError extends Schema.TaggedError<
  DatabaseError,
  { readonly brand: unique symbol }
>()("DatabaseError", {
  cause: Schema.Defect(),
}) {}

/**
 * Drizzle is the query vocabulary; this service owns the connection lifecycle and turns
 * rejected queries into a typed `DatabaseError`. The Postgres layer for the hosted profile
 * joins in Phase 2 step 3 (docs/adr/0003, docs/adr/0017).
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
        const client = drizzle({ client: connection });
        return Database.of({
          run: Effect.fn("Database.run")(
            <A>(query: (client: DrizzleClient) => Promise<A>) =>
              Effect.tryPromise({
                try: () => query(client),
                catch: (cause) => new DatabaseError({ cause }),
              })
          ),
        });
      })
    );
}
