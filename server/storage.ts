
import { db } from "./db";
import { 
  dailySales, orders, stockDetails,
  type DailySale, type InsertDailySale,
  type Order, type InsertOrder,
  type StockDetail, type InsertStockDetail
} from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Sales
  getDailySales(): Promise<DailySale[]>;
  bulkUpdateDailySales(sales: InsertDailySale[]): Promise<DailySale[]>;
  
  // Orders
  getOrders(): Promise<Order[]>;
  bulkCreateOrders(orders: InsertOrder[]): Promise<Order[]>;

  // Stock
  getStockDetails(): Promise<StockDetail[]>;
  bulkUpdateStockDetails(stock: InsertStockDetail[]): Promise<StockDetail[]>;
}

export class DatabaseStorage implements IStorage {
  // Sales
  async getDailySales(): Promise<DailySale[]> {
    return await db.select().from(dailySales);
  }

  async bulkUpdateDailySales(salesData: InsertDailySale[]): Promise<DailySale[]> {
    const results: DailySale[] = [];
    const today = new Date().toISOString().split('T')[0];
    
    for (const sale of salesData) {
      const [updated] = await db.insert(dailySales)
        .values({ ...sale, date: today })
        .onConflictDoUpdate({
          target: dailySales.brandNumber,
          set: {
            ...sale,
            date: today,
          }
        })
        .returning();
      results.push(updated);
    }
    return results;
  }

  // Orders
  async getOrders(): Promise<Order[]> {
    return await db.select().from(orders);
  }

  async bulkCreateOrders(ordersData: InsertOrder[]): Promise<Order[]> {
    if (ordersData.length === 0) return [];
    return await db.insert(orders).values(ordersData).returning();
  }

  // Stock
  async getStockDetails(): Promise<StockDetail[]> {
    return await db.select().from(stockDetails);
  }

  async bulkUpdateStockDetails(stockData: InsertStockDetail[]): Promise<StockDetail[]> {
    const results: StockDetail[] = [];
    const today = new Date().toISOString().split('T')[0];
    for (const item of stockData) {
      const [updated] = await db.insert(stockDetails)
        .values({ ...item, date: today })
        .onConflictDoUpdate({
          target: stockDetails.brandNumber,
          set: {
            ...item,
            date: today,
            updatedAt: new Date(),
          }
        })
        .returning();
      results.push(updated);
    }
    return results;
  }
}

export const storage = new DatabaseStorage();
