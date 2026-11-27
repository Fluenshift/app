import { mkdir } from "node:fs/promises";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { ServerConfig } from "@grifando/env";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import { migrate as migratePostgres } from "drizzle-orm/node-postgres/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
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

// Applies the migrations of a folder that a database has not applied yet. A folder it cannot
// read, or a migration that fails, stops the layer: the server never runs on an unknown schema.
const migrateWith = (
  migrationsFolder: string | undefined,
  migrate: (config: { readonly migrationsFolder: string }) => Promise<void>
) =>
  migrationsFolder === undefined
    ? Effect.void
    : Effect.tryPromise({
        try: () => migrate({ migrationsFolder }),
        catch: (cause) => new DatabaseError({ cause }),
      });

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
>()("@grifando/db/Database") {
  /**
   * An embedded PGlite database: in memory without `dataDir`, on disk with it, migrated from
   * `migrationsFolder` when one is given.
   */
  static readonly pglite = (
    options: {
      readonly dataDir?: string;
      readonly migrationsFolder?: string;
    } = {}
  ) =>
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
        const client = drizzlePglite({ client: connection });
        yield* migrateWith(options.migrationsFolder, (config) =>
          migratePglite(client, config)
        );
        return Database.of(serviceOf(client));
      })
    );

  /** A pool of connections to a Postgres server, migrated from `migrationsFolder`. */
  static readonly postgres = (options: {
    readonly migrationsFolder?: string;
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
        const client = drizzlePostgres({ client: pool });
        yield* migrateWith(options.migrationsFolder, (config) =>
          migratePostgres(client, config)
        );
        return Database.of(serviceOf(client));
      })
    );

  /**
   * The database of the deploy profile, as `ServerConfig` names it, with the migrations of
   * `MIGRATIONS_PATH` applied.
   */
  static readonly layer = Layer.unwrap(
    Effect.gen(function* () {
      const { database, migrationsPath } = yield* ServerConfig;
      return database.kind === "postgres"
        ? Database.postgres({
            migrationsFolder: migrationsPath,
            url: database.url,
          })
        : Database.pglite({
            dataDir: database.dataDirectory,
            migrationsFolder: migrationsPath,
          });
    })
  );
}
