
import { 
  dailySales, orders, stockDetails, users,
  type DailySale, type InsertDailySale,
  type Order, type InsertOrder,
  type StockDetail, type InsertStockDetail,
  type User, type InsertUser
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { db } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User>;
  
  // Sales
  getDailySales(): Promise<DailySale[]>;
  bulkUpdateDailySales(sales: InsertDailySale[]): Promise<DailySale[]>;
  
  // Orders
  getOrders(): Promise<Order[]>;
  bulkCreateOrders(orders: InsertOrder[]): Promise<Order[]>;

  // Stock
  getStockDetails(): Promise<StockDetail[]>;
  bulkUpdateStockDetails(stock: InsertStockDetail[]): Promise<StockDetail[]>;
  syncOrdersToStock(): Promise<{ syncedOrderIds: number[]; updatedStockCount: number }>;
  syncStockToDailySales(): Promise<{ updatedSalesCount: number }>;

  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      conObject: {
        connectionString: process.env.DATABASE_URL,
      },
      createTableIfMissing: true,
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, partialUser: Partial<User>): Promise<User> {
    const [user] = await db.update(users).set(partialUser).where(eq(users.id, id)).returning();
    return user;
  }

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

  async syncOrdersToStock(): Promise<{ syncedOrderIds: number[]; updatedStockCount: number }> {
    const unsyncedOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.dataUpdated, "NO"));

    if (unsyncedOrders.length === 0) {
      return { syncedOrderIds: [], updatedStockCount: 0 };
    }

    type AggKey = string;
    type AggValue = {
      brandNumber: string;
      brandName: string;
      packSize: string;
      casesDelivered: number;
      bottlesDelivered: number;
      breakage: number;
      orderIds: number[];
    };

    const aggregation = new Map<AggKey, AggValue>();

    for (const order of unsyncedOrders) {
      const key = `${order.brandNumber}||${order.brandName}||${order.packSize}`;
      const existing = aggregation.get(key);
      if (existing) {
        existing.casesDelivered += order.qtyCasesDelivered ?? 0;
        existing.bottlesDelivered += order.qtyBottlesDelivered ?? 0;
        existing.breakage += order.breakageBottleQty ?? 0;
        existing.orderIds.push(order.id);
      } else {
        aggregation.set(key, {
          brandNumber: order.brandNumber,
          brandName: order.brandName,
          packSize: order.packSize,
          casesDelivered: order.qtyCasesDelivered ?? 0,
          bottlesDelivered: order.qtyBottlesDelivered ?? 0,
          breakage: order.breakageBottleQty ?? 0,
          orderIds: [order.id],
        });
      }
    }

    let updatedStockCount = 0;
    const today = new Date().toISOString().split('T')[0];
    const syncedOrderIds: number[] = [];

    const allStock = await db.select().from(stockDetails);

    const aggEntries = Array.from(aggregation.values());
    for (const agg of aggEntries) {
      const packParts = agg.packSize.split("/").map((s: string) => s.trim());
      const qtyFromPack = packParts.length > 0 ? parseInt(packParts[0], 10) : NaN;
      const sizeFromPack = packParts.length > 1 ? packParts[1] : "";

      const matchedStock = allStock.find(s => {
        if (s.brandNumber !== agg.brandNumber) return false;
        const brandMatch = s.brandName.trim().toLowerCase() === agg.brandName.trim().toLowerCase();
        if (!brandMatch) return false;
        const sizeMatch = sizeFromPack && s.size.trim().toLowerCase().includes(sizeFromPack.trim().toLowerCase());
        if (!sizeMatch) return false;
        const qtyMatch = !isNaN(qtyFromPack) && s.quantityPerCase === qtyFromPack;
        if (!qtyMatch) return false;
        return true;
      });

      if (matchedStock) {
        const newCases = (matchedStock.stockInCases ?? 0) + agg.casesDelivered;
        const newBottles = (matchedStock.stockInBottles ?? 0) + agg.bottlesDelivered;
        const qtyPerCase = matchedStock.quantityPerCase ?? 1;
        const newTotalBottles = (newCases * qtyPerCase) + newBottles;
        const mrpNum = parseFloat(matchedStock.mrp) || 0;
        const newTotalValue = (newTotalBottles * mrpNum).toFixed(2);
        const newBreakage = (matchedStock.breakage ?? 0) + agg.breakage;

        await db.update(stockDetails)
          .set({
            stockInCases: newCases,
            stockInBottles: newBottles,
            totalStockBottles: newTotalBottles,
            totalStockValue: newTotalValue,
            breakage: newBreakage,
            date: today,
            updatedAt: new Date(),
          })
          .where(eq(stockDetails.id, matchedStock.id));

        updatedStockCount++;
        syncedOrderIds.push(...agg.orderIds);
      }
    }

    for (const orderId of syncedOrderIds) {
      await db.update(orders)
        .set({ dataUpdated: "YES" })
        .where(eq(orders.id, orderId));
    }

    return { syncedOrderIds, updatedStockCount };
  }

  async syncStockToDailySales(): Promise<{ updatedSalesCount: number }> {
    const allStock = await db.select().from(stockDetails);
    const allSales = await db.select().from(dailySales);

    if (allStock.length === 0 || allSales.length === 0) {
      return { updatedSalesCount: 0 };
    }

    let updatedSalesCount = 0;

    for (const sale of allSales) {
      const matchedStock = allStock.find(s => {
        if (s.brandNumber !== sale.brandNumber) return false;
        if (s.brandName.trim().toLowerCase() !== sale.brandName.trim().toLowerCase()) return false;
        const stockSize = s.size.trim().toLowerCase().replace(/\s+/g, "");
        const saleSize = sale.size.trim().toLowerCase().replace(/\s+/g, "");
        if (stockSize !== saleSize && !stockSize.includes(saleSize) && !saleSize.includes(stockSize)) return false;
        if (s.quantityPerCase !== sale.quantityPerCase) return false;
        return true;
      });

      if (matchedStock) {
        await db.update(dailySales)
          .set({
            openingBalanceBottles: matchedStock.totalStockBottles ?? 0,
            newStockCases: matchedStock.stockInCases ?? 0,
            newStockBottles: matchedStock.stockInBottles ?? 0,
          })
          .where(eq(dailySales.id, sale.id));

        updatedSalesCount++;
      }
    }

    return { updatedSalesCount };
  }
}

export const storage = new DatabaseStorage();
