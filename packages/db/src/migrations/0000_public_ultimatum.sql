CREATE TABLE "evaluations" (
	"band" text NOT NULL,
	"content_hash" text NOT NULL,
	"corrected_text" text NOT NULL,
	"evaluated_at" timestamp with time zone NOT NULL,
	"evaluated_english_word_count" integer NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"input_tokens" integer,
	"insertion_order" integer GENERATED ALWAYS AS IDENTITY (sequence name "evaluations_insertion_order_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"latency_milliseconds" integer,
	"learner_id" text NOT NULL,
	"model" text NOT NULL,
	"origin" text NOT NULL,
	"original_text" text NOT NULL,
	"output_tokens" integer,
	"provider" text NOT NULL,
	"rubric_version" text NOT NULL,
	"score" integer NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"summary" text NOT NULL,
	CONSTRAINT "evaluations_learner_id_unique" UNIQUE("learner_id","id"),
	CONSTRAINT "evaluations_band_check" CHECK ("evaluations"."band" in ('Needs revision', 'Understandable', 'Clear', 'Natural')),
	CONSTRAINT "evaluations_origin_check" CHECK ("evaluations"."origin" in ('work', 'practice')),
	CONSTRAINT "evaluations_score_check" CHECK ("evaluations"."score" between 0 and 100),
	CONSTRAINT "evaluations_word_count_check" CHECK ("evaluations"."evaluated_english_word_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"byte_end" integer NOT NULL,
	"byte_start" integer NOT NULL,
	"category" text NOT NULL,
	"correction" text NOT NULL,
	"evaluation_id" text NOT NULL,
	"explanation" text NOT NULL,
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "findings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"learner_id" text NOT NULL,
	"original_text" text NOT NULL,
	"position" integer NOT NULL,
	"severity" text NOT NULL,
	CONSTRAINT "findings_evaluation_position_unique" UNIQUE("evaluation_id","position"),
	CONSTRAINT "findings_category_check" CHECK ("findings"."category" in ('Spelling', 'Article', 'Verb form/tense', 'Preposition', 'Word choice', 'Grammar/syntax', 'Punctuation/capitalization', 'Clarity', 'Other')),
	CONSTRAINT "findings_severity_check" CHECK ("findings"."severity" in ('Minor', 'Moderate', 'Major')),
	CONSTRAINT "findings_byte_span_check" CHECK ("findings"."byte_start" >= 0 and "findings"."byte_end" > "findings"."byte_start")
);
--> statement-breakpoint
CREATE TABLE "learners" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suggestions" (
	"alternative" text,
	"byte_end" integer NOT NULL,
	"byte_start" integer NOT NULL,
	"evaluation_id" text NOT NULL,
	"explanation" text NOT NULL,
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "suggestions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"learner_id" text NOT NULL,
	"original_text" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "suggestions_evaluation_position_unique" UNIQUE("evaluation_id","position"),
	CONSTRAINT "suggestions_byte_span_check" CHECK ("suggestions"."byte_start" >= 0 and "suggestions"."byte_end" > "suggestions"."byte_start")
);
--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_learner_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_evaluation_fk" FOREIGN KEY ("learner_id","evaluation_id") REFERENCES "public"."evaluations"("learner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_evaluation_fk" FOREIGN KEY ("learner_id","evaluation_id") REFERENCES "public"."evaluations"("learner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "evaluations_learner_evaluated_at_idx" ON "evaluations" USING btree ("learner_id","evaluated_at","insertion_order");--> statement-breakpoint
CREATE INDEX "evaluations_learner_rubric_evaluated_at_idx" ON "evaluations" USING btree ("learner_id","rubric_version","evaluated_at");--> statement-breakpoint
CREATE INDEX "findings_learner_category_idx" ON "findings" USING btree ("learner_id","category");--> statement-breakpoint
CREATE INDEX "findings_learner_correction_idx" ON "findings" USING btree ("learner_id","original_text","correction");