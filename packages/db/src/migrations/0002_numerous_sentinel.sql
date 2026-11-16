CREATE TABLE "enrichments" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"evaluation_id" text PRIMARY KEY NOT NULL,
	"learner_id" text NOT NULL,
	"model" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "enrichments" ADD CONSTRAINT "enrichments_evaluation_fk" FOREIGN KEY ("learner_id","evaluation_id") REFERENCES "public"."evaluations"("learner_id","id") ON DELETE cascade ON UPDATE no action;