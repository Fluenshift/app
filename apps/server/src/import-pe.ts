// Imports PE's local Learning History into the local profile, once, as Rubric Version 1
// (docs/adr/0018, decision 2; src/history/pe-import.ts). Stop PE and the product's server first,
// build the server, then run from apps/server with the data directory the server reads. The
// local profile in Docker keeps it in .data/pglite at the repository root:
//
//   pnpm docker:down && pnpm build && cd apps/server
//   DATA_DIRECTORY=../../.data/pglite node dist/import-pe.mjs --dry-run <PE's local.db>
//   DATA_DIRECTORY=../../.data/pglite node dist/import-pe.mjs <PE's local.db>
//
// Both runs print the same counts, or the import is not accepted. A refusal exits with 1.
import { NodeRuntime } from "@effect/platform-node";
import { ServerConfig } from "@fluenshift/env";
import { Console, Effect } from "effect";

import { runPeImport } from "./history/pe-import";

NodeRuntime.runMain(
  runPeImport(process.argv.slice(2)).pipe(
    Effect.flatMap((report) => Console.log(report)),
    Effect.provide(ServerConfig.layer)
  )
);
