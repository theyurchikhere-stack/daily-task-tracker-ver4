CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY,
	"device_id" text NOT NULL,
	"title" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"date" text NOT NULL,
	"time" text,
	"category" text DEFAULT 'personal' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"reminder" boolean DEFAULT false NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "tasks_device_date_idx" ON "tasks" ("device_id","date");