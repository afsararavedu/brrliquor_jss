
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

    const brandAggregation: Record<string, { casesDelivered: number; bottlesDelivered: number; breakage: number }> = {};
    for (const order of unsyncedOrders) {
      const bn = order.brandNumber;
      if (!brandAggregation[bn]) {
        brandAggregation[bn] = { casesDelivered: 0, bottlesDelivered: 0, breakage: 0 };
      }
      brandAggregation[bn].casesDelivered += order.qtyCasesDelivered ?? 0;
      brandAggregation[bn].bottlesDelivered += order.qtyBottlesDelivered ?? 0;
      brandAggregation[bn].breakage += order.breakageBottleQty ?? 0;
    }

    let updatedStockCount = 0;
    const today = new Date().toISOString().split('T')[0];
    const syncedBrands = new Set<string>();

    for (const [brandNumber, agg] of Object.entries(brandAggregation)) {
      const [existingStock] = await db
        .select()
        .from(stockDetails)
        .where(eq(stockDetails.brandNumber, brandNumber));

      if (existingStock) {
        const newCases = (existingStock.stockInCases ?? 0) + agg.casesDelivered;
        const newBottles = (existingStock.stockInBottles ?? 0) + agg.bottlesDelivered;
        const qtyPerCase = existingStock.quantityPerCase ?? 1;
        const newTotalBottles = (newCases * qtyPerCase) + newBottles;
        const mrpNum = parseFloat(existingStock.mrp) || 0;
        const newTotalValue = (newTotalBottles * mrpNum).toFixed(2);
        const newBreakage = (existingStock.breakage ?? 0) + agg.breakage;

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
          .where(eq(stockDetails.brandNumber, brandNumber));

        updatedStockCount++;
        syncedBrands.add(brandNumber);
      }
    }

    const syncedIds = unsyncedOrders
      .filter(o => syncedBrands.has(o.brandNumber))
      .map(o => o.id);
    for (const orderId of syncedIds) {
      await db.update(orders)
        .set({ dataUpdated: "YES" })
        .where(eq(orders.id, orderId));
    }

    return { syncedOrderIds: syncedIds, updatedStockCount };
  }
}

export const storage = new DatabaseStorage();
