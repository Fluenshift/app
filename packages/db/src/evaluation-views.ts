// Read-only handles on the Evaluation tables, for the Academy, which reads Evaluations and never
// writes them (docs/migration/MIGRATION_PROTOCOL.md, Phase 5f). Each is a view over the table of
// the same name with the same columns, declared existing so that no migration creates it: a query
// through it reads the table itself. Drizzle has no insert, update or delete for a view, so a write
// through one fails type checking, and lint keeps Academy code off the tables themselves
// (oxlint.config.ts). drizzle-kit reads only schema.ts, so these never reach a migration.
import { pgView } from "drizzle-orm/pg-core";

import { evaluationColumns, findingColumns, suggestionColumns } from "./schema";

export const evaluationsView = pgView(
  "evaluations",
  evaluationColumns()
).existing();

export const findingsView = pgView("findings", findingColumns()).existing();

export const suggestionsView = pgView(
  "suggestions",
  suggestionColumns()
).existing();
