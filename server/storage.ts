
import { 
  dailySales, orders, stockDetails, users,
  type DailySale, type InsertDailySale,
  type Order, type InsertOrder,
  type StockDetail, type InsertStockDetail,
  type User, type InsertUser
} from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
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
    return await db.select().from(orders).orderBy(desc(orders.id));
  }

  async bulkCreateOrders(ordersData: InsertOrder[]): Promise<Order[]> {
    if (ordersData.length === 0) return [];
    const withTotalBottles = ordersData.map(order => {
      const packParts = order.packSize.split("/").map((s: string) => s.trim());
      const qtyPerCase = packParts.length > 0 ? parseInt(packParts[0], 10) : 0;
      const totalBottles = (isNaN(qtyPerCase) ? 0 : qtyPerCase) * (order.qtyCasesDelivered ?? 0) + (order.qtyBottlesDelivered ?? 0);
      return { ...order, totalBottles };
    });
    return await db.insert(orders).values(withTotalBottles).returning();
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

    const allStock = await db.select().from(stockDetails);

    type AggKey = string;
    type AggValue = {
      stockId: number;
      casesDelivered: number;
      bottlesDelivered: number;
      totalBottles: number;
      orderIds: number[];
    };

    const aggregation = new Map<AggKey, AggValue>();

    for (const order of unsyncedOrders) {
      const matchedStock = allStock.find(s => {
        if (s.brandNumber !== order.brandNumber) return false;
        if (s.brandName.trim().toLowerCase() !== order.brandName.trim().toLowerCase()) return false;
        const stockSize = s.size.trim().toLowerCase().replace(/\s+/g, "");
        const orderPackSize = order.packSize.trim().toLowerCase().replace(/\s+/g, "");
        if (!orderPackSize.includes(stockSize)) return false;
        return true;
      });

      if (!matchedStock) continue;

      const key = String(matchedStock.id);
      const existing = aggregation.get(key);
      if (existing) {
        existing.casesDelivered += order.qtyCasesDelivered ?? 0;
        existing.bottlesDelivered += order.qtyBottlesDelivered ?? 0;
        existing.totalBottles += order.totalBottles ?? 0;
        existing.orderIds.push(order.id);
      } else {
        aggregation.set(key, {
          stockId: matchedStock.id,
          casesDelivered: order.qtyCasesDelivered ?? 0,
          bottlesDelivered: order.qtyBottlesDelivered ?? 0,
          totalBottles: order.totalBottles ?? 0,
          orderIds: [order.id],
        });
      }
    }

    let updatedStockCount = 0;
    const today = new Date().toISOString().split('T')[0];
    const syncedOrderIds: number[] = [];

    for (const agg of Array.from(aggregation.values())) {
      const matchedStock = allStock.find(s => s.id === agg.stockId)!;

      const newCases = (matchedStock.stockInCases ?? 0) + agg.casesDelivered;
      const newBottles = (matchedStock.stockInBottles ?? 0) + agg.bottlesDelivered;
      const newTotalBottles = (matchedStock.totalStockBottles ?? 0) + agg.totalBottles;
      const mrpNum = parseFloat(matchedStock.mrp) || 0;
      const newTotalValue = (newTotalBottles * mrpNum).toFixed(2);

      await db.update(stockDetails)
        .set({
          stockInCases: newCases,
          stockInBottles: newBottles,
          totalStockBottles: newTotalBottles,
          totalStockValue: newTotalValue,
          date: today,
          updatedAt: new Date(),
        })
        .where(eq(stockDetails.id, matchedStock.id));

      updatedStockCount++;
      syncedOrderIds.push(...agg.orderIds);
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
