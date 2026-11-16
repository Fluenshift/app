// The product schema, on Postgres for the hosted profile and PGlite locally (docs/adr/0017).
// Ported from PE packages/db/src/schema/index.ts (5e831bb): every row now belongs to a Learner
// (docs/adr/0003), an Evaluation records the origin of its Writing Sample (docs/adr/0010), and
// the invariants SQLite left to the application are constraints here. `pnpm db:generate` turns
// a change of this file into the next migration.
import {
  ERROR_CATEGORIES,
  EXERCISE_TYPES,
  FINDING_SEVERITIES,
  MASTERY_LEVELS,
  MISTAKE_CATEGORIES,
  MISTAKE_SEVERITIES,
  PROFICIENCY_BANDS,
  WRITING_SAMPLE_ORIGINS,
} from "@fluenshift/contract";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
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

// The Academy (Phase 5): Grifando's mistake loop over the Learner's Findings. Ported from
// Grifando prisma/schema.prisma (74dbb9f); every row belongs to a Learner (docs/adr/0003).

export const mistakePatterns = pgTable(
  "mistake_patterns",
  {
    category: text("category").notNull(),
    consecutiveCorrectCount: integer("consecutive_correct_count")
      .notNull()
      .default(0),
    // Recall history for the half-life model: every Attempt and every new Occurrence in
    // writing is a recall event, and lastPracticedAt is the time of the latest one.
    correctCount: integer("correct_count").notNull().default(0),
    exampleCorrection: text("example_correction").notNull(),
    exampleOriginal: text("example_original").notNull(),
    firstSeenAt: moment("first_seen_at").notNull().defaultNow(),
    id: text("id").primaryKey(),
    incorrectCount: integer("incorrect_count").notNull().default(0),
    lastPracticedAt: moment("last_practiced_at").notNull().defaultNow(),
    lastSeenAt: moment("last_seen_at").notNull().defaultNow(),
    learnerId: text("learner_id").notNull(),
    masteryLevel: text("mastery_level").notNull().default("ACTIVE"),
    occurrenceCount: integer("occurrence_count").notNull().default(1),
    patternKey: text("pattern_key").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.learnerId],
      foreignColumns: [learners.id],
      name: "mistake_patterns_learner_fk",
    }).onDelete("cascade"),
    // Occurrences reference a Mistake Pattern together with its Learner.
    unique("mistake_patterns_learner_id_unique").on(table.learnerId, table.id),
    unique("mistake_patterns_learner_category_key_unique").on(
      table.learnerId,
      table.category,
      table.patternKey
    ),
    check(
      "mistake_patterns_category_check",
      sql`${table.category} in (${oneOf(MISTAKE_CATEGORIES)})`
    ),
    check(
      "mistake_patterns_mastery_check",
      sql`${table.masteryLevel} in (${oneOf(MASTERY_LEVELS)})`
    ),
    check(
      "mistake_patterns_counts_check",
      sql`${table.occurrenceCount} >= 0 and ${table.correctCount} >= 0 and ${table.incorrectCount} >= 0 and ${table.consecutiveCorrectCount} >= 0`
    ),
    index("mistake_patterns_learner_mastery_idx").on(
      table.learnerId,
      table.masteryLevel
    ),
  ]
);

// One Finding, or one Naturalness Note, as the Academy records it under a Mistake Pattern
// (docs/adr/0004). It belongs to the Evaluation it came from, and goes when that Evaluation is
// deleted; an error points at its Finding by position, and records the Rubric Version of its
// Evaluation (docs/adr/0015).
export const occurrences = pgTable(
  "occurrences",
  {
    category: text("category").notNull(),
    correctedSpan: text("corrected_span").notNull(),
    createdAt: moment("created_at").notNull().defaultNow(),
    evaluationId: text("evaluation_id").notNull(),
    example: text("example").notNull(),
    explanation: text("explanation").notNull(),
    findingPosition: integer("finding_position"),
    id: text("id").primaryKey(),
    // The mistake carries a pattern over from the Learner's first language (docs/adr/0005).
    l1Transfer: boolean("l1_transfer").notNull().default(false),
    learnerId: text("learner_id").notNull(),
    originalSpan: text("original_span").notNull(),
    patternId: text("pattern_id").notNull(),
    rubricVersion: text("rubric_version").notNull(),
    severity: text("severity").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.learnerId, table.evaluationId],
      foreignColumns: [evaluations.learnerId, evaluations.id],
      name: "occurrences_evaluation_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.evaluationId, table.findingPosition],
      foreignColumns: [findings.evaluationId, findings.position],
      name: "occurrences_finding_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.learnerId, table.patternId],
      foreignColumns: [mistakePatterns.learnerId, mistakePatterns.id],
      name: "occurrences_pattern_fk",
    }).onDelete("cascade"),
    check(
      "occurrences_category_check",
      sql`${table.category} in (${oneOf(MISTAKE_CATEGORIES)})`
    ),
    check(
      "occurrences_severity_check",
      sql`${table.severity} in (${oneOf(MISTAKE_SEVERITIES)})`
    ),
    // An error comes from a Finding; a Naturalness Note does not.
    check(
      "occurrences_finding_check",
      sql`(${table.severity} = 'ERROR') = (${table.findingPosition} is not null)`
    ),
    index("occurrences_learner_pattern_idx").on(
      table.learnerId,
      table.patternId
    ),
    index("occurrences_evaluation_idx").on(table.evaluationId),
  ]
);

// The Trainer's Enrichment of one Evaluation's Findings (docs/adr/0004), which records the model
// that answered (docs/adr/0012), as Grifando's writing analysis did. One per Evaluation; it goes
// when that Evaluation is deleted.
export const enrichments = pgTable(
  "enrichments",
  {
    createdAt: moment("created_at").notNull().defaultNow(),
    evaluationId: text("evaluation_id").primaryKey(),
    learnerId: text("learner_id").notNull(),
    model: text("model").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.learnerId, table.evaluationId],
      foreignColumns: [evaluations.learnerId, evaluations.id],
      name: "enrichments_evaluation_fk",
    }).onDelete("cascade"),
  ]
);

export const exercises = pgTable(
  "exercises",
  {
    createdAt: moment("created_at").notNull().defaultNow(),
    // Target difficulty 1 to 5 requested from the generator; null before difficulty
    // targeting existed.
    difficulty: integer("difficulty"),
    id: text("id").primaryKey(),
    learnerId: text("learner_id").notNull(),
    promptData: jsonb("prompt_data").notNull(),
    sourcePatternId: text("source_pattern_id"),
    type: text("type").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.learnerId],
      foreignColumns: [learners.id],
      name: "exercises_learner_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.sourcePatternId],
      foreignColumns: [mistakePatterns.id],
      name: "exercises_source_pattern_fk",
    }).onDelete("set null"),
    unique("exercises_learner_id_unique").on(table.learnerId, table.id),
    check(
      "exercises_type_check",
      sql`${table.type} in (${oneOf(EXERCISE_TYPES)})`
    ),
    check(
      "exercises_difficulty_check",
      sql`${table.difficulty} is null or ${table.difficulty} between 1 and 5`
    ),
    index("exercises_learner_created_at_idx").on(
      table.learnerId,
      table.createdAt
    ),
  ]
);

export const exerciseAttempts = pgTable(
  "exercise_attempts",
  {
    attemptedAt: moment("attempted_at").notNull().defaultNow(),
    exerciseId: text("exercise_id").notNull(),
    feedback: text("feedback").notNull(),
    id: text("id").primaryKey(),
    isCorrect: boolean("is_correct").notNull(),
    learnerId: text("learner_id").notNull(),
    learnerAnswer: text("learner_answer").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.learnerId, table.exerciseId],
      foreignColumns: [exercises.learnerId, exercises.id],
      name: "exercise_attempts_exercise_fk",
    }).onDelete("cascade"),
    index("exercise_attempts_exercise_idx").on(table.exerciseId),
  ]
);

export const categoryAbilities = pgTable(
  "category_abilities",
  {
    attemptCount: integer("attempt_count").notNull().default(0),
    category: text("category").notNull(),
    id: text("id").primaryKey(),
    learnerId: text("learner_id").notNull(),
    rating: doublePrecision("rating").notNull().default(1000),
    updatedAt: moment("updated_at").notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.learnerId],
      foreignColumns: [learners.id],
      name: "category_abilities_learner_fk",
    }).onDelete("cascade"),
    unique("category_abilities_learner_category_unique").on(
      table.learnerId,
      table.category
    ),
    check(
      "category_abilities_category_check",
      sql`${table.category} in (${oneOf(MISTAKE_CATEGORIES)})`
    ),
    check(
      "category_abilities_attempt_count_check",
      sql`${table.attemptCount} >= 0`
    ),
  ]
);

// A term the Learner saves while writing; its source, when set, is one of the Learner's own
// Evaluations, which replace Grifando's writing sessions (docs/adr/0004).
export const vocabularyItems = pgTable(
  "vocabulary_items",
  {
    createdAt: moment("created_at").notNull().defaultNow(),
    exampleSentence: text("example_sentence").notNull(),
    id: text("id").primaryKey(),
    // Breaks ties between items of one moment, newest insertion first.
    insertionOrder: integer("insertion_order").generatedAlwaysAsIdentity(),
    learnerId: text("learner_id").notNull(),
    meaningPt: text("meaning_pt").notNull(),
    sourceEvaluationId: text("source_evaluation_id"),
    term: text("term").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.learnerId],
      foreignColumns: [learners.id],
      name: "vocabulary_items_learner_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.sourceEvaluationId],
      foreignColumns: [evaluations.id],
      name: "vocabulary_items_source_evaluation_fk",
    }).onDelete("set null"),
    index("vocabulary_items_learner_created_at_idx").on(
      table.learnerId,
      table.createdAt
    ),
  ]
);
