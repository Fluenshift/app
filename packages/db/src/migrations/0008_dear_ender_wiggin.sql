CREATE TABLE "pe_imports" (
	"evaluation_count" integer NOT NULL,
	"finding_count" integer NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"learner_id" text PRIMARY KEY NOT NULL,
	"suggestion_count" integer NOT NULL,
	CONSTRAINT "pe_imports_counts_check" CHECK ("pe_imports"."evaluation_count" >= 0 and "pe_imports"."finding_count" >= 0 and "pe_imports"."suggestion_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "pe_imports" ADD CONSTRAINT "pe_imports_learner_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;