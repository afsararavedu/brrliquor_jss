
import { db } from "./db";
import { 
  dailySales, orders, 
  type DailySale, type InsertDailySale,
  type Order, type InsertOrder 
} from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Sales
  getDailySales(): Promise<DailySale[]>;
  bulkUpdateDailySales(sales: InsertDailySale[]): Promise<DailySale[]>;
  
  // Orders
  getOrders(): Promise<Order[]>;
  bulkCreateOrders(orders: InsertOrder[]): Promise<Order[]>;
}

export class DatabaseStorage implements IStorage {
  // Sales
  async getDailySales(): Promise<DailySale[]> {
    return await db.select().from(dailySales);
  }

  async bulkUpdateDailySales(salesData: InsertDailySale[]): Promise<DailySale[]> {
    const results: DailySale[] = [];
    
    for (const sale of salesData) {
      const [updated] = await db.insert(dailySales)
        .values(sale)
        .onConflictDoUpdate({
          target: dailySales.brandNumber,
          set: {
            closingBalanceCases: sale.closingBalanceCases,
            closingBalanceBottles: sale.closingBalanceBottles,
            mrp: sale.mrp,
            totalSaleValue: sale.totalSaleValue,
            brandName: sale.brandName,
            size: sale.size,
            quantityPerCase: sale.quantityPerCase,
            openingBalanceBottles: sale.openingBalanceBottles,
            newStockCases: sale.newStockCases,
            newStockBottles: sale.newStockBottles,
            soldBottles: sale.soldBottles,
            saleValue: sale.saleValue,
            breakageBottles: sale.breakageBottles,
            totalClosingStock: sale.totalClosingStock,
            finalClosingBalance: sale.finalClosingBalance,
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
}

export const storage = new DatabaseStorage();
