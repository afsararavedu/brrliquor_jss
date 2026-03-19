CREATE TABLE "sales_submit_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"is_submitted" boolean DEFAULT false NOT NULL,
	"submitted_at" timestamp,
	CONSTRAINT "sales_submit_status_date_unique" UNIQUE("date")
);
