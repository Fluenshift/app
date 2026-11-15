CREATE TABLE "category_abilities" (
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"category" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"learner_id" text NOT NULL,
	"rating" double precision DEFAULT 1000 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_abilities_learner_category_unique" UNIQUE("learner_id","category"),
	CONSTRAINT "category_abilities_category_check" CHECK ("category_abilities"."category" in ('ARTICLES', 'PREPOSITIONS', 'VERB_TENSE', 'SUBJECT_VERB_AGREEMENT', 'VOCABULARY', 'WORD_ORDER', 'SPELLING', 'PUNCTUATION', 'UNNATURAL_PHRASING', 'LITERAL_TRANSLATION', 'COLLOCATION', 'PRONOUNS', 'COUNTABLE_UNCOUNTABLE')),
	CONSTRAINT "category_abilities_attempt_count_check" CHECK ("category_abilities"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "exercise_attempts" (
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"exercise_id" text NOT NULL,
	"feedback" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"is_correct" boolean NOT NULL,
	"learner_id" text NOT NULL,
	"learner_answer" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"difficulty" integer,
	"id" text PRIMARY KEY NOT NULL,
	"learner_id" text NOT NULL,
	"prompt_data" jsonb NOT NULL,
	"source_pattern_id" text,
	"type" text NOT NULL,
	CONSTRAINT "exercises_learner_id_unique" UNIQUE("learner_id","id"),
	CONSTRAINT "exercises_type_check" CHECK ("exercises"."type" in ('MULTIPLE_CHOICE', 'FILL_BLANK', 'REWRITE', 'TRANSLATION')),
	CONSTRAINT "exercises_difficulty_check" CHECK ("exercises"."difficulty" is null or "exercises"."difficulty" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "mistake_patterns" (
	"category" text NOT NULL,
	"consecutive_correct_count" integer DEFAULT 0 NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"example_correction" text NOT NULL,
	"example_original" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"incorrect_count" integer DEFAULT 0 NOT NULL,
	"last_practiced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"learner_id" text NOT NULL,
	"mastery_level" text DEFAULT 'ACTIVE' NOT NULL,
	"occurrence_count" integer DEFAULT 1 NOT NULL,
	"pattern_key" text NOT NULL,
	CONSTRAINT "mistake_patterns_learner_id_unique" UNIQUE("learner_id","id"),
	CONSTRAINT "mistake_patterns_learner_category_key_unique" UNIQUE("learner_id","category","pattern_key"),
	CONSTRAINT "mistake_patterns_category_check" CHECK ("mistake_patterns"."category" in ('ARTICLES', 'PREPOSITIONS', 'VERB_TENSE', 'SUBJECT_VERB_AGREEMENT', 'VOCABULARY', 'WORD_ORDER', 'SPELLING', 'PUNCTUATION', 'UNNATURAL_PHRASING', 'LITERAL_TRANSLATION', 'COLLOCATION', 'PRONOUNS', 'COUNTABLE_UNCOUNTABLE')),
	CONSTRAINT "mistake_patterns_mastery_check" CHECK ("mistake_patterns"."mastery_level" in ('ACTIVE', 'IMPROVING', 'MASTERED')),
	CONSTRAINT "mistake_patterns_counts_check" CHECK ("mistake_patterns"."occurrence_count" >= 0 and "mistake_patterns"."correct_count" >= 0 and "mistake_patterns"."incorrect_count" >= 0 and "mistake_patterns"."consecutive_correct_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "occurrences" (
	"category" text NOT NULL,
	"corrected_span" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"evaluation_id" text NOT NULL,
	"example" text NOT NULL,
	"explanation" text NOT NULL,
	"finding_position" integer,
	"id" text PRIMARY KEY NOT NULL,
	"l1_transfer" boolean DEFAULT false NOT NULL,
	"learner_id" text NOT NULL,
	"original_span" text NOT NULL,
	"pattern_id" text NOT NULL,
	"rubric_version" text NOT NULL,
	"severity" text NOT NULL,
	CONSTRAINT "occurrences_category_check" CHECK ("occurrences"."category" in ('ARTICLES', 'PREPOSITIONS', 'VERB_TENSE', 'SUBJECT_VERB_AGREEMENT', 'VOCABULARY', 'WORD_ORDER', 'SPELLING', 'PUNCTUATION', 'UNNATURAL_PHRASING', 'LITERAL_TRANSLATION', 'COLLOCATION', 'PRONOUNS', 'COUNTABLE_UNCOUNTABLE')),
	CONSTRAINT "occurrences_severity_check" CHECK ("occurrences"."severity" in ('ERROR', 'UNNATURAL')),
	CONSTRAINT "occurrences_finding_check" CHECK (("occurrences"."severity" = 'ERROR') = ("occurrences"."finding_position" is not null))
);
--> statement-breakpoint
CREATE TABLE "vocabulary_items" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"example_sentence" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"insertion_order" integer GENERATED ALWAYS AS IDENTITY (sequence name "vocabulary_items_insertion_order_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"learner_id" text NOT NULL,
	"meaning_pt" text NOT NULL,
	"source_evaluation_id" text,
	"term" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "category_abilities" ADD CONSTRAINT "category_abilities_learner_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_exercise_fk" FOREIGN KEY ("learner_id","exercise_id") REFERENCES "public"."exercises"("learner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_learner_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_source_pattern_fk" FOREIGN KEY ("source_pattern_id") REFERENCES "public"."mistake_patterns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mistake_patterns" ADD CONSTRAINT "mistake_patterns_learner_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_evaluation_fk" FOREIGN KEY ("learner_id","evaluation_id") REFERENCES "public"."evaluations"("learner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_finding_fk" FOREIGN KEY ("evaluation_id","finding_position") REFERENCES "public"."findings"("evaluation_id","position") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "occurrences" ADD CONSTRAINT "occurrences_pattern_fk" FOREIGN KEY ("learner_id","pattern_id") REFERENCES "public"."mistake_patterns"("learner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_items" ADD CONSTRAINT "vocabulary_items_learner_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_items" ADD CONSTRAINT "vocabulary_items_source_evaluation_fk" FOREIGN KEY ("source_evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exercise_attempts_exercise_idx" ON "exercise_attempts" USING btree ("exercise_id");--> statement-breakpoint
CREATE INDEX "exercises_learner_created_at_idx" ON "exercises" USING btree ("learner_id","created_at");--> statement-breakpoint
CREATE INDEX "mistake_patterns_learner_mastery_idx" ON "mistake_patterns" USING btree ("learner_id","mastery_level");--> statement-breakpoint
CREATE INDEX "occurrences_learner_pattern_idx" ON "occurrences" USING btree ("learner_id","pattern_id");--> statement-breakpoint
CREATE INDEX "occurrences_evaluation_idx" ON "occurrences" USING btree ("evaluation_id");--> statement-breakpoint
CREATE INDEX "vocabulary_items_learner_created_at_idx" ON "vocabulary_items" USING btree ("learner_id","created_at");