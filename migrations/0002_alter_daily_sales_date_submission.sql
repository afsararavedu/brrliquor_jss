-- Add is_submitted column to daily_sales if not exists
ALTER TABLE "daily_sales" ADD COLUMN IF NOT EXISTS "is_submitted" boolean DEFAULT false;
--> statement-breakpoint
-- Drop old unique index on (brand_number, size) if it exists
DROP INDEX IF EXISTS "daily_sales_brand_size_idx";
--> statement-breakpoint
-- Create new unique index on (brand_number, size, date) if not exists
CREATE UNIQUE INDEX IF NOT EXISTS "daily_sales_brand_size_date_idx" ON "daily_sales" USING btree ("brand_number","size","date");
