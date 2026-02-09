
import { pgTable, text, serial, integer, numeric, date, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

// Table for the "Sales" page (matching figmascreen.png)
export const dailySales = pgTable("daily_sales", {
  id: serial("id").primaryKey(),
  brandNumber: text("brand_number").notNull().unique(), // Added unique to brandNumber for upsert
  brandName: text("brand_name").notNull(),
  size: text("size").notNull(),
  quantityPerCase: integer("quantity_per_case").notNull(),
  openingBalanceBottles: integer("opening_balance_bottles").default(0),
  newStockCases: integer("new_stock_cases").default(0),
  newStockBottles: integer("new_stock_bottles").default(0),
  // Editable fields
  closingBalanceCases: integer("closing_balance_cases").default(0),
  closingBalanceBottles: integer("closing_balance_bottles").default(0),
  mrp: numeric("mrp").notNull(),
  totalSaleValue: numeric("total_sale_value").default('0'), // Renamed from saleValue
  soldBottles: integer("sold_bottles").default(0),
  saleValue: numeric("sale_value").default('0'),
  breakageBottles: integer("breakage_bottles").default(0),
  totalClosingStock: integer("total_closing_stock").default(0),
  finalClosingBalance: integer("final_closing_balance").default(0),
  date: date("date").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Table for the "Other Data" -> Order Form (matching Image 1)
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  brandNumber: text("brand_number").notNull(),
  brandName: text("brand_name").notNull(),
  productType: text("product_type").notNull(),
  packType: text("pack_type").notNull(),
  packSize: text("pack_size").notNull(),
  qtyCasesDelivered: integer("qty_cases_delivered").default(0),
  qtyBottlesDelivered: integer("qty_bottles_delivered").default(0),
  ratePerCase: numeric("rate_per_case").default('0'),
  unitRatePerBottle: numeric("unit_rate_per_bottle").default('0'),
  totalAmount: numeric("total_amount").default('0'),
  breakageBottleQty: integer("breakage_bottle_qty").default(0),
  totalBottles: integer("total_bottles").default(0),
  remarks: text("remarks"),
  dataUpdated: text("data_updated").default("NO").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Table for the "Stock" page (matching image_1768795267421.png)
export const stockDetails = pgTable("stock_details", {
  id: serial("id").primaryKey(),
  brandNumber: text("brand_number").notNull().unique(),
  brandName: text("brand_name").notNull(),
  size: text("size").notNull(),
  quantityPerCase: integer("quantity_per_case").notNull(),
  stockInCases: integer("stock_in_cases").default(0),
  stockInBottles: integer("stock_in_bottles").default(0),
  totalStockBottles: integer("total_stock_bottles").default(0),
  mrp: numeric("mrp").notNull(),
  totalStockValue: numeric("total_stock_value").default('0'),
  breakage: integer("breakage").default(0),
  remarks: text("remarks"),
  date: date("date").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === SCHEMAS ===

export const insertDailySaleSchema = createInsertSchema(dailySales).omit({ 
  id: true, 
  createdAt: true 
});

export const insertOrderSchema = createInsertSchema(orders).omit({ 
  id: true, 
  createdAt: true,
  dataUpdated: true,
  totalBottles: true
});

export const insertStockDetailSchema = createInsertSchema(stockDetails).omit({
  id: true,
  updatedAt: true
});

// === TYPES ===

export type DailySale = typeof dailySales.$inferSelect;
export type InsertDailySale = z.infer<typeof insertDailySaleSchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export type StockDetail = typeof stockDetails.$inferSelect;
export type InsertStockDetail = z.infer<typeof insertStockDetailSchema>;

// User table for authentication and roles
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ["admin", "employee"] }).notNull().default("employee"),
  tempPassword: text("temp_password"),
  mustResetPassword: boolean("must_reset_password").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  createdAt: true 
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// Request types
export type BulkCreateDailySalesRequest = InsertDailySale[];
export type BulkCreateOrdersRequest = InsertOrder[];
export type BulkUpdateStockRequest = InsertStockDetail[];
