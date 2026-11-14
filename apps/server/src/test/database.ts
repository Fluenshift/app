// A database for the persistence tests: PGlite in a fresh temporary directory with the product
// migrations applied, acting for the local Learner. Ported from PE apps/server/src/test/database.ts,
// whose SQLite file it replaces.
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Database } from "@fluenshift/db";
import { ServerConfig } from "@fluenshift/env";
import { ConfigProvider, Layer } from "effect";

import { CurrentLearner } from "../learner-identity";

const MIGRATIONS = path.resolve(
  import.meta.dirname,
  "../../../../packages/db/src/migrations"
);

export const makeTemporaryDatabase = () =>
  mkdtemp(path.join(tmpdir(), "fluenshift-")).then((directory) => {
    const config = ServerConfig.layer.pipe(
      Layer.provide(
        ConfigProvider.layer(
          ConfigProvider.fromEnvRecord({
            DATA_DIRECTORY: path.join(directory, "pglite"),
            MIGRATIONS_PATH: MIGRATIONS,
          })
        )
      )
    );
    return {
      directory,
      layer: Layer.merge(
        Database.layer.pipe(Layer.provide(config)),
        CurrentLearner.local
      ),
    };
  });
