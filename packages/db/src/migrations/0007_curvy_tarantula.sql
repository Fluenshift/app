CREATE TABLE "rate_limit_windows" (
	"count" integer DEFAULT 0 NOT NULL,
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	CONSTRAINT "rate_limit_windows_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE INDEX "rate_limit_windows_window_start_idx" ON "rate_limit_windows" USING btree ("window_start");