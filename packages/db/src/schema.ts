// The product schema, on Postgres for the hosted profile and PGlite locally (docs/adr/0017).
// Ported from PE packages/db/src/schema/index.ts (5e831bb): every row now belongs to a Learner
// (docs/adr/0003), an Evaluation records the origin of its Writing Sample (docs/adr/0010), and
// the invariants SQLite left to the application are constraints here. `pnpm db:generate` turns
// a change of this file into the next migration.
import {
  ERROR_CATEGORIES,
  FINDING_SEVERITIES,
  PROFICIENCY_BANDS,
  WRITING_SAMPLE_ORIGINS,
} from "@fluenshift/contract";
import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

// The members of a closed value set inside a check constraint. A migration is DDL, which takes
// no parameters, so the values are written into it; none of them holds a quote.
const oneOf = (values: readonly string[]) =>
  sql.raw(values.map((value) => `'${value}'`).join(", "));

const moment = (name: string) =>
  timestamp(name, { mode: "date", withTimezone: true });

export const learners = pgTable("learners", {
  createdAt: moment("created_at").notNull().defaultNow(),
  id: text("id").primaryKey(),
});

export const evaluations = pgTable(
  "evaluations",
  {
    band: text("band").notNull(),
    contentHash: text("content_hash").notNull(),
    correctedText: text("corrected_text").notNull(),
    evaluatedAt: moment("evaluated_at").notNull(),
    evaluatedEnglishWordCount: integer(
      "evaluated_english_word_count"
    ).notNull(),
    id: text("id").primaryKey(),
    inputTokens: integer("input_tokens"),
    // Breaks ties between Evaluations of one moment, newest insertion first, as SQLite's rowid
    // did in PE.
    insertionOrder: integer("insertion_order").generatedAlwaysAsIdentity(),
    latencyMilliseconds: integer("latency_milliseconds"),
    learnerId: text("learner_id").notNull(),
    model: text("model").notNull(),
    origin: text("origin").notNull(),
    originalText: text("original_text").notNull(),
    outputTokens: integer("output_tokens"),
    provider: text("provider").notNull(),
    rubricVersion: text("rubric_version").notNull(),
    score: integer("score").notNull(),
    submittedAt: moment("submitted_at").notNull(),
    summary: text("summary").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.learnerId],
      foreignColumns: [learners.id],
      name: "evaluations_learner_fk",
    }).onDelete("cascade"),
    // Findings and Suggestions reference an Evaluation together with its Learner.
    unique("evaluations_learner_id_unique").on(table.learnerId, table.id),
    check(
      "evaluations_band_check",
      sql`${table.band} in (${oneOf(PROFICIENCY_BANDS)})`
    ),
    check(
      "evaluations_origin_check",
      sql`${table.origin} in (${oneOf(WRITING_SAMPLE_ORIGINS)})`
    ),
    check("evaluations_score_check", sql`${table.score} between 0 and 100`),
    check(
      "evaluations_word_count_check",
      sql`${table.evaluatedEnglishWordCount} >= 0`
    ),
    index("evaluations_learner_evaluated_at_idx").on(
      table.learnerId,
      table.evaluatedAt,
      table.insertionOrder
    ),
    index("evaluations_learner_rubric_evaluated_at_idx").on(
      table.learnerId,
      table.rubricVersion,
      table.evaluatedAt
    ),
  ]
);

export const findings = pgTable(
  "findings",
  {
    byteEnd: integer("byte_end").notNull(),
    byteStart: integer("byte_start").notNull(),
    category: text("category").notNull(),
    correction: text("correction").notNull(),
    evaluationId: text("evaluation_id").notNull(),
    explanation: text("explanation").notNull(),
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    learnerId: text("learner_id").notNull(),
    originalText: text("original_text").notNull(),
    position: integer("position").notNull(),
    severity: text("severity").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.learnerId, table.evaluationId],
      foreignColumns: [evaluations.learnerId, evaluations.id],
      name: "findings_evaluation_fk",
    }).onDelete("cascade"),
    unique("findings_evaluation_position_unique").on(
      table.evaluationId,
      table.position
    ),
    check(
      "findings_category_check",
      sql`${table.category} in (${oneOf(ERROR_CATEGORIES)})`
    ),
    check(
      "findings_severity_check",
      sql`${table.severity} in (${oneOf(FINDING_SEVERITIES)})`
    ),
    check(
      "findings_byte_span_check",
      sql`${table.byteStart} >= 0 and ${table.byteEnd} > ${table.byteStart}`
    ),
    index("findings_learner_category_idx").on(table.learnerId, table.category),
    index("findings_learner_correction_idx").on(
      table.learnerId,
      table.originalText,
      table.correction
    ),
  ]
);

export const suggestions = pgTable(
  "suggestions",
  {
    alternative: text("alternative"),
    byteEnd: integer("byte_end").notNull(),
    byteStart: integer("byte_start").notNull(),
    evaluationId: text("evaluation_id").notNull(),
    explanation: text("explanation").notNull(),
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    learnerId: text("learner_id").notNull(),
    originalText: text("original_text").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.learnerId, table.evaluationId],
      foreignColumns: [evaluations.learnerId, evaluations.id],
      name: "suggestions_evaluation_fk",
    }).onDelete("cascade"),
    unique("suggestions_evaluation_position_unique").on(
      table.evaluationId,
      table.position
    ),
    check(
      "suggestions_byte_span_check",
      sql`${table.byteStart} >= 0 and ${table.byteEnd} > ${table.byteStart}`
    ),
  ]
);
