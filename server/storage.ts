
import { 
  dailySales, orders, stockDetails, users, shopDetails,
  type DailySale, type InsertDailySale,
  type Order, type InsertOrder,
  type StockDetail, type InsertStockDetail,
  type User, type InsertUser,
  type ShopDetail, type InsertShopDetail
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
  syncStockToDailySales(): Promise<{ updatedSalesCount: number; createdSalesCount: number }>;
  syncDailySalesToStock(): Promise<{ updatedStockCount: number }>;

  // Shop Details
  createShopDetail(shop: InsertShopDetail): Promise<ShopDetail>;
  getShopDetails(): Promise<ShopDetail[]>;
  getShopDetailByLicenseNo(licenseNo: string): Promise<ShopDetail | undefined>;
  getShopDetailByIcdcNumber(icdcNumber: string): Promise<ShopDetail | undefined>;

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
          target: [dailySales.brandNumber, dailySales.size],
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
      const [created] = await db.insert(stockDetails)
        .values({ ...item, date: today })
        .returning();
      results.push(created);
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

    const normalizeBrand = (b: string) => b.replace(/^0+/, '') || '0';
    const normalizeName = (n: string) => n.trim().toLowerCase().replace(/\s+/g, "");

    const extractSizeFromPackSize = (packSize: string): string => {
      const parts = packSize.split("/");
      if (parts.length >= 2) return parts[1].trim();
      return packSize.trim();
    };

    const extractQtyPerCaseFromPackSize = (packSize: string): number => {
      const parts = packSize.split("/");
      if (parts.length >= 1) {
        const num = parseInt(parts[0].trim(), 10);
        return isNaN(num) ? 0 : num;
      }
      return 0;
    };

    type AggValue = {
      stockId: number | null;
      brandNumber: string;
      brandName: string;
      size: string;
      quantityPerCase: number;
      mrpPerBottle: number;
      casesDelivered: number;
      bottlesDelivered: number;
      totalBottles: number;
      orderIds: number[];
    };

    const updateAgg = new Map<string, AggValue>();
    const createAgg = new Map<string, AggValue>();

    for (const order of unsyncedOrders) {
      const orderBrandNorm = normalizeBrand(order.brandNumber);
      const orderNameNorm = normalizeName(order.brandName);
      const orderSize = extractSizeFromPackSize(order.packSize);
      const orderSizeNorm = orderSize.toLowerCase().replace(/\s+/g, "");

      const matchedStock = allStock.find(s => {
        if (normalizeBrand(s.brandNumber) !== orderBrandNorm) return false;
        if (normalizeName(s.brandName) !== orderNameNorm) return false;
        const stockSizeNorm = s.size.trim().toLowerCase().replace(/\s+/g, "");
        return stockSizeNorm === orderSizeNorm;
      });

      const compositeKey = `${orderBrandNorm}|${orderNameNorm}|${orderSizeNorm}`;
      const aggMap = matchedStock ? updateAgg : createAgg;

      const existing = aggMap.get(compositeKey);
      if (existing) {
        existing.casesDelivered += order.qtyCasesDelivered ?? 0;
        existing.bottlesDelivered += order.qtyBottlesDelivered ?? 0;
        existing.totalBottles += order.totalBottles ?? 0;
        existing.orderIds.push(order.id);
      } else {
        aggMap.set(compositeKey, {
          stockId: matchedStock ? matchedStock.id : null,
          brandNumber: order.brandNumber,
          brandName: order.brandName,
          size: orderSize,
          quantityPerCase: extractQtyPerCaseFromPackSize(order.packSize),
          mrpPerBottle: parseFloat(order.unitRatePerBottle ?? '0'),
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

    for (const agg of Array.from(updateAgg.values())) {
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

    for (const agg of Array.from(createAgg.values())) {
      const mrpEstimate = agg.mrpPerBottle > 0 ? agg.mrpPerBottle : 0;
      const totalValue = (agg.totalBottles * mrpEstimate).toFixed(2);

      await db.insert(stockDetails).values({
        brandNumber: agg.brandNumber,
        brandName: agg.brandName,
        size: agg.size,
        quantityPerCase: agg.quantityPerCase,
        stockInCases: agg.casesDelivered,
        stockInBottles: agg.bottlesDelivered,
        totalStockBottles: agg.totalBottles,
        mrp: String(mrpEstimate),
        totalStockValue: totalValue,
        breakage: 0,
        date: today,
      });

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

  async syncStockToDailySales(): Promise<{ updatedSalesCount: number; createdSalesCount: number }> {
    const allStock = await db.select().from(stockDetails);
    let allSales = await db.select().from(dailySales);

    if (allStock.length === 0) {
      return { updatedSalesCount: 0, createdSalesCount: 0 };
    }

    let updatedSalesCount = 0;
    let createdSalesCount = 0;
    const processedSaleIds = new Set<number>();

    for (const stock of allStock) {
      const normalizedStockSize = stock.size.trim().toLowerCase().replace(/\s+/g, "");

      const matchedSale = allSales.find(sale => {
        if (processedSaleIds.has(sale.id)) return false;
        if (sale.brandNumber !== stock.brandNumber) return false;
        const saleSize = sale.size.trim().toLowerCase().replace(/\s+/g, "");
        if (normalizedStockSize !== saleSize && !normalizedStockSize.includes(saleSize) && !saleSize.includes(normalizedStockSize)) return false;
        return true;
      });

      if (matchedSale) {
        await db.update(dailySales)
          .set({
            openingBalanceBottles: stock.totalStockBottles ?? 0,
            newStockCases: stock.stockInCases ?? 0,
            newStockBottles: stock.stockInBottles ?? 0,
          })
          .where(eq(dailySales.id, matchedSale.id));

        processedSaleIds.add(matchedSale.id);
        updatedSalesCount++;
      } else {
        try {
          const [created] = await db.insert(dailySales).values({
            brandNumber: stock.brandNumber,
            brandName: stock.brandName,
            size: stock.size,
            quantityPerCase: stock.quantityPerCase,
            openingBalanceBottles: stock.totalStockBottles ?? 0,
            newStockCases: stock.stockInCases ?? 0,
            newStockBottles: stock.stockInBottles ?? 0,
            closingBalanceCases: 0,
            closingBalanceBottles: 0,
            mrp: stock.mrp || '0',
            totalSaleValue: '0',
            soldBottles: 0,
            saleValue: '0',
            breakageBottles: 0,
            totalClosingStock: 0,
            finalClosingBalance: '0',
          }).onConflictDoUpdate({
            target: [dailySales.brandNumber, dailySales.size],
            set: {
              openingBalanceBottles: stock.totalStockBottles ?? 0,
              newStockCases: stock.stockInCases ?? 0,
              newStockBottles: stock.stockInBottles ?? 0,
            },
          }).returning();
          if (created) {
            createdSalesCount++;
            allSales.push(created);
          }
        } catch (e: any) {
          console.log(`Skipping daily_sales insert for brand ${stock.brandNumber} size ${stock.size}: ${e.message}`);
        }
      }
    }

    return { updatedSalesCount, createdSalesCount };
  }

  async syncDailySalesToStock(): Promise<{ updatedStockCount: number }> {
    const allSales = await db.select().from(dailySales);
    const allStock = await db.select().from(stockDetails);

    if (allSales.length === 0 || allStock.length === 0) {
      return { updatedStockCount: 0 };
    }

    let updatedStockCount = 0;

    for (const stock of allStock) {
      const matchedSale = allSales.find(sale => {
        if (sale.brandNumber !== stock.brandNumber) return false;
        if (sale.brandName.trim().toLowerCase() !== stock.brandName.trim().toLowerCase()) return false;
        const saleSize = sale.size.trim().toLowerCase().replace(/\s+/g, "");
        const stockSize = stock.size.trim().toLowerCase().replace(/\s+/g, "");
        if (stockSize !== saleSize && !stockSize.includes(saleSize) && !saleSize.includes(stockSize)) return false;
        return true;
      });

      if (matchedSale) {
        await db.update(stockDetails)
          .set({
            stockInCases: matchedSale.closingBalanceCases ?? 0,
            stockInBottles: matchedSale.closingBalanceBottles ?? 0,
            totalStockBottles: matchedSale.totalClosingStock ?? 0,
          })
          .where(eq(stockDetails.id, stock.id));

        updatedStockCount++;
      }
    }

    return { updatedStockCount };
  }

  async createShopDetail(shop: InsertShopDetail): Promise<ShopDetail> {
    const [created] = await db.insert(shopDetails).values(shop).returning();
    return created;
  }

  async getShopDetails(): Promise<ShopDetail[]> {
    return await db.select().from(shopDetails).orderBy(desc(shopDetails.id));
  }

  async getShopDetailByLicenseNo(licenseNo: string): Promise<ShopDetail | undefined> {
    const [detail] = await db.select().from(shopDetails).where(eq(shopDetails.licenseNo, licenseNo)).limit(1);
    return detail;
  }

  async getShopDetailByIcdcNumber(icdcNumber: string): Promise<ShopDetail | undefined> {
    const [detail] = await db.select().from(shopDetails).where(eq(shopDetails.icdcNumber, icdcNumber)).limit(1);
    return detail;
  }
}

export const storage = new DatabaseStorage();
