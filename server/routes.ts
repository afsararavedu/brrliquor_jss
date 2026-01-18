
import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Sales
  app.get(api.sales.list.path, async (req, res) => {
    const sales = await storage.getDailySales();
    // If no sales exist, maybe return some seed/mock data if we haven't seeded yet?
    // But better to seed in the seed function.
    res.json(sales);
  });

  app.post(api.sales.bulkUpdate.path, async (req, res) => {
    try {
      const input = api.sales.bulkUpdate.input.parse(req.body);
      const result = await storage.bulkUpdateDailySales(input);
      res.status(201).json(result);
    } catch (err) {
       if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // Orders
  app.get(api.orders.list.path, async (req, res) => {
    const orders = await storage.getOrders();
    res.json(orders);
  });

  app.post(api.orders.bulkCreate.path, async (req, res) => {
    try {
      const input = api.orders.bulkCreate.input.parse(req.body);
      const result = await storage.bulkCreateOrders(input);
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });
  
  // Upload
  app.post(api.upload.create.path, upload.single('file'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    // In a real app, save to S3 or disk. Here just ack.
    res.json({ 
      message: "File uploaded successfully", 
      filename: req.file.originalname 
    });
  });

  // Seed Data
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const sales = await storage.getDailySales();
  if (sales.length === 0) {
    // Seed with data from Figma screenshot
    const seedData = [
      {
        brandNumber: "5029",
        brandName: "KINGFISHER ULTRA LAGER BEER",
        size: "650 ml",
        quantityPerCase: 12,
        openingBalanceBottles: 18,
        newStockCases: 22,
        newStockBottles: 18,
        closingBalanceCases: 0,
        closingBalanceBottles: 10,
        mrp: "880",
        totalSaleValue: "0"
      },
      {
        brandNumber: "0261",
        brandName: "TI COURIER NAPOLEON FINEST PURE GRAPE FRENCH BRANDY",
        size: "750 ml",
        quantityPerCase: 24,
        openingBalanceBottles: 21,
        newStockCases: 21,
        newStockBottles: 21,
        closingBalanceCases: 0,
        closingBalanceBottles: 0,
        mrp: "440",
        totalSaleValue: "0"
      },
      {
        brandNumber: "3064",
        brandName: "Monthly subscription",
        size: "180ml",
        quantityPerCase: 48,
        openingBalanceBottles: 252,
        newStockCases: 352,
        newStockBottles: 352,
        closingBalanceCases: 0,
        closingBalanceBottles: 0,
        mrp: "220",
        totalSaleValue: "352"
      }
    ];
    await storage.bulkUpdateDailySales(seedData);
  }
}
