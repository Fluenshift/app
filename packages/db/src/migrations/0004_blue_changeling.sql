CREATE TABLE "interview_sessions" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"learner_id" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	CONSTRAINT "interview_sessions_learner_id_unique" UNIQUE("learner_id","id"),
	CONSTRAINT "interview_sessions_status_check" CHECK ("interview_sessions"."status" in ('ACTIVE', 'ENDED'))
);
--> statement-breakpoint
CREATE TABLE "interview_turns" (
	"answered_at" timestamp with time zone,
	"evaluation_id" text,
	"id" text PRIMARY KEY NOT NULL,
	"interview_session_id" text NOT NULL,
	"learner_id" text NOT NULL,
	"model" text NOT NULL,
	"turn_order" integer NOT NULL,
	"question" text NOT NULL,
	CONSTRAINT "interview_turns_evaluation_unique" UNIQUE("evaluation_id"),
	CONSTRAINT "interview_turns_session_order_unique" UNIQUE("interview_session_id","turn_order"),
	CONSTRAINT "interview_turns_answer_check" CHECK ("interview_turns"."evaluation_id" is null or "interview_turns"."answered_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_learner_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_turns" ADD CONSTRAINT "interview_turns_session_fk" FOREIGN KEY ("learner_id","interview_session_id") REFERENCES "public"."interview_sessions"("learner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_turns" ADD CONSTRAINT "interview_turns_evaluation_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interview_sessions_learner_created_at_idx" ON "interview_sessions" USING btree ("learner_id","created_at");