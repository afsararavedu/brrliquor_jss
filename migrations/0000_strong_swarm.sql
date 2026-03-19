CREATE TABLE "daily_sales" (
        "id" serial PRIMARY KEY NOT NULL,
        "brand_number" text NOT NULL,
        "brand_name" text NOT NULL,
        "size" text NOT NULL,
        "quantity_per_case" integer NOT NULL,
        "opening_balance_bottles" integer DEFAULT 0,
        "new_stock_cases" integer DEFAULT 0,
        "new_stock_bottles" integer DEFAULT 0,
        "closing_balance_cases" integer DEFAULT 0,
        "closing_balance_bottles" integer DEFAULT 0,
        "mrp" numeric NOT NULL,
        "total_sale_value" numeric DEFAULT '0',
        "sold_bottles" integer DEFAULT 0,
        "sale_value" numeric DEFAULT '0',
        "breakage_bottles" integer DEFAULT 0,
        "total_closing_stock" integer DEFAULT 0,
        "final_closing_balance" numeric DEFAULT '0',
        "date" date DEFAULT now(),
        "is_submitted" boolean DEFAULT false,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "orders" (
        "id" serial PRIMARY KEY NOT NULL,
        "brand_number" text NOT NULL,
        "brand_name" text NOT NULL,
        "product_type" text NOT NULL,
        "pack_type" text NOT NULL,
        "pack_size" text NOT NULL,
        "qty_cases_delivered" integer DEFAULT 0,
        "qty_bottles_delivered" integer DEFAULT 0,
        "rate_per_case" numeric DEFAULT '0',
        "unit_rate_per_bottle" numeric DEFAULT '0',
        "total_amount" numeric DEFAULT '0',
        "breakage_bottle_qty" integer DEFAULT 0,
        "total_bottles" integer DEFAULT 0,
        "remarks" text,
        "invoice_date" text,
        "icdc_number" text,
        "data_updated" text DEFAULT 'NO' NOT NULL,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shop_details" (
        "id" serial PRIMARY KEY NOT NULL,
        "name" text,
        "address" text,
        "retail_shop_excise_tax" text,
        "license_no" text,
        "pan_number" text,
        "name_phone" text,
        "invoice_date" text,
        "gazette_code_licensee_issue_date" text,
        "icdc_number" text,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stock_details" (
        "id" serial PRIMARY KEY NOT NULL,
        "brand_number" text NOT NULL,
        "brand_name" text NOT NULL,
        "size" text NOT NULL,
        "quantity_per_case" integer NOT NULL,
        "stock_in_cases" integer DEFAULT 0,
        "stock_in_bottles" integer DEFAULT 0,
        "total_stock_bottles" integer DEFAULT 0,
        "mrp" numeric NOT NULL,
        "total_stock_value" numeric DEFAULT '0',
        "breakage" integer DEFAULT 0,
        "remarks" text,
        "date" date DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
        "id" serial PRIMARY KEY NOT NULL,
        "username" text NOT NULL,
        "password" text NOT NULL,
        "role" text DEFAULT 'employee' NOT NULL,
        "temp_password" text,
        "must_reset_password" boolean DEFAULT false,
        "created_at" timestamp DEFAULT now(),
        CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "daily_sales_brand_size_date_idx" ON "daily_sales" USING btree ("brand_number","size","date");