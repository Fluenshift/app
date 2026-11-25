// A database for the persistence tests: PGlite in a fresh temporary directory with the product
// migrations applied, acting for the local Learner under the configuration of the local
// profile. Ported from PE apps/server/src/test/database.ts, whose SQLite file it replaces.
//
// Creating a PGlite cluster and applying every migration takes about 1.8 seconds, which made
// database setup most of the server suite (#112). Each test therefore starts from a copy of one
// migrated data directory, which takes about 0.2 seconds. The template sits in the system
// temporary directory under a hash of the migrations and the lockfile, so a new migration or a
// new PGlite gets a new template, and every worker and checkout reuses it. The layer still opens
// the copy through `Database.layer`, whose migrator then finds nothing left to apply.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdtemp, readdir, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Database } from "@grifando/db";
import { ServerConfig } from "@grifando/env";
import { ConfigProvider, Effect, Layer } from "effect";

import { CurrentLearner } from "../learner-identity";

const MIGRATIONS = path.resolve(
  import.meta.dirname,
  "../../../../packages/db/src/migrations"
);
const LOCKFILE = path.resolve(
  import.meta.dirname,
  "../../../../pnpm-lock.yaml"
);

// What a template holds depends on the migrations and on the PGlite and Drizzle versions,
// which the lockfile pins.
const templateKey = async () => {
  const entries = await readdir(MIGRATIONS, {
    recursive: true,
    withFileTypes: true,
  });
  const files = [
    ...entries
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(entry.parentPath, entry.name))
      .toSorted(),
    LOCKFILE,
  ];
  const hash = createHash("sha256").update(
    files.map((file) => path.relative(MIGRATIONS, file)).join("\n")
  );
  for (const content of await Promise.all(
    files.map((file) => readFile(file))
  )) {
    hash.update(content);
  }
  return hash.digest("hex").slice(0, 16);
};

// Migrates a new data directory beside `target`, then moves it into place in one rename, so a
// template is never seen half written. Workers that race build one each; the first rename wins.
const buildTemplate = async (target: string) => {
  const scratch = await mkdtemp(`${target}-`);
  const dataDir = path.join(scratch, "pglite");
  await Effect.runPromise(
    Effect.scoped(
      Layer.build(Database.pglite({ dataDir, migrationsFolder: MIGRATIONS }))
    )
  );
  await rename(dataDir, target).catch((error: unknown) => {
    if (!existsSync(target)) {
      throw error;
    }
  });
  await rm(scratch, { force: true, recursive: true });
};

let template: Promise<string> | undefined;

const migratedTemplate = () => {
  template ??= templateKey().then(async (key) => {
    const target = path.join(tmpdir(), `grifando-pglite-${key}`);
    if (!existsSync(target)) {
      await buildTemplate(target);
    }
    return target;
  });
  return template;
};

/**
 * The local profile's configuration, its `Database` over the PGlite data directory, and the
 * local Learner: what a persistence test or the Docker smoke's seed runs against.
 */
export const localProfileLayer = (dataDirectory: string) => {
  const config = ServerConfig.layer.pipe(
    Layer.provide(
      ConfigProvider.layer(
        ConfigProvider.fromEnvRecord({
          DATA_DIRECTORY: dataDirectory,
          MIGRATIONS_PATH: MIGRATIONS,
        })
      )
    )
  );
  return Layer.mergeAll(
    Database.layer.pipe(Layer.provide(config)),
    config,
    CurrentLearner.local
  );
};

export const makeTemporaryDatabase = () =>
  Promise.all([
    migratedTemplate(),
    mkdtemp(path.join(tmpdir(), "grifando-")),
  ]).then(async ([source, directory]) => {
    const dataDirectory = path.join(directory, "pglite");
    await cp(source, dataDirectory, { recursive: true });
    return { directory, layer: localProfileLayer(dataDirectory) };
  });
