CREATE TABLE "calendar_feeds" (
	"id" serial PRIMARY KEY,
	"device_id" text NOT NULL,
	"name" text DEFAULT 'Календарь iPhone' NOT NULL,
	"url" text NOT NULL,
	"color" text DEFAULT '#ff3b30' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "calendar_feeds_device_idx" ON "calendar_feeds" ("device_id");