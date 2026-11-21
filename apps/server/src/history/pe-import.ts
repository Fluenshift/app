// The one-time import of PE's local Learning History into the product (docs/adr/0018, decision 2).
import { Database } from "@fluenshift/db";
import { ServerConfig } from "@fluenshift/env";
import { Effect, Schema } from "effect";

/** Why an import read, checked or wrote nothing. */
export class PeImportError extends Schema.TaggedError<
  PeImportError,
  { readonly brand: unique symbol }
>()("PeImportError", { message: Schema.String }) {}

/** What an import writes, or what a dry run would write. */
export interface PeImportCounts {
  readonly evaluations: number;
  readonly findings: number;
  readonly suggestions: number;
}

export const importPeHistory = Effect.fn("PeImport.importPeHistory")(function* (
  _file: string,
  _options: { readonly dryRun: boolean }
) {
  yield* Database;
  const counts: PeImportCounts = {
    evaluations: 0,
    findings: 0,
    suggestions: 0,
  };
  return counts;
});

export const runPeImport = Effect.fn("PeImport.runPeImport")(function* (
  _args: readonly string[]
) {
  yield* ServerConfig;
  return "";
});
