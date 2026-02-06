
import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });

function extractTextFromPdfBuffer(buffer: Buffer): string {
  const content = buffer.toString("binary");
  const textChunks: string[] = [];

  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  while ((match = streamRegex.exec(content)) !== null) {
    const streamData = match[1];
    const textMatches = streamData.match(/\(([^)]*)\)/g);
    if (textMatches) {
      for (const tm of textMatches) {
        const cleaned = tm.slice(1, -1)
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "")
          .replace(/\\\\/g, "\\")
          .replace(/\\([()\\])/g, "$1");
        if (cleaned.trim()) {
          textChunks.push(cleaned);
        }
      }
    }
    const tjMatches = streamData.match(/\[(.*?)\]\s*TJ/g);
    if (tjMatches) {
      for (const tj of tjMatches) {
        const innerTexts = tj.match(/\(([^)]*)\)/g);
        if (innerTexts) {
          const combined = innerTexts.map(t => t.slice(1, -1)).join("");
          if (combined.trim()) {
            textChunks.push(combined);
          }
        }
      }
    }
  }

  return textChunks.join("\n");
}

// Helper to parse PDF text into rows
async function parsePdfOrders(buffer: Buffer) {
  try {
    const text = extractTextFromPdfBuffer(buffer);
    console.log("Extracted PDF text:", text.substring(0, 500));
    const lines = text.split('\n');
    const orders: any[] = [];

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5) {
        if (/^\d+$/.test(parts[0])) {
          orders.push({
            brandNumber: parts[0],
            brandName: parts.slice(1, Math.max(2, parts.length - 7)).join(" "),
            productType: "Beer", 
            packType: "G",
            packSize: "12 / 650 ml",
            qtyCasesDelivered: parseInt(parts[parts.length - 5]) || 0,
            qtyBottlesDelivered: parseInt(parts[parts.length - 4]) || 0,
            ratePerCase: parts[parts.length - 3] || "0",
            unitRatePerBottle: parts[parts.length - 2] || "0",
            totalAmount: parts[parts.length - 1] || "0",
            breakageBottleQty: 0,
            remarks: ""
          });
        }
      }
    }

    if (orders.length === 0 && text.trim().length > 0) {
      orders.push({
        brandNumber: "",
        brandName: "Imported from PDF",
        productType: "",
        packType: "",
        packSize: "",
        qtyCasesDelivered: 0,
        qtyBottlesDelivered: 0,
        ratePerCase: "0",
        unitRatePerBottle: "0",
        totalAmount: "0",
        breakageBottleQty: 0,
        remarks: text.substring(0, 200)
      });
    }

    return orders;
  } catch (err: any) {
    console.error("PDF Parse Error:", err);
    throw new Error("Could not parse PDF content: " + err.message);
  }
}

import { setupAuth } from "./auth";
import bcrypt from "bcryptjs";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

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

  // Stock
  app.get(api.stock.list.path, async (req, res) => {
    const stock = await storage.getStockDetails();
    res.json(stock);
  });

  app.post(api.stock.bulkUpdate.path, async (req, res) => {
    try {
      const input = api.stock.bulkUpdate.input.parse(req.body);
      const result = await storage.bulkUpdateStockDetails(input);
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
  app.post(api.upload.create.path, upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    if (!req.file.originalname.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({ message: "Only PDF files are allowed" });
    }

    try {
      const parsedOrders = await parsePdfOrders(req.file.buffer);
      res.json({ 
        message: `Successfully parsed ${parsedOrders.length} orders from PDF. Please review and confirm before saving.`, 
        filename: req.file.originalname,
        orders: parsedOrders,
        ordersCount: parsedOrders.length
      });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to parse PDF: " + err.message });
    }
  });

  // Seed Data
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  // Create admin and employee users if they don't exist
  const adminUser = await storage.getUserByUsername("admin");
  if (!adminUser) {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await storage.createUser({
      username: "admin",
      password: hashedPassword,
      role: "admin",
      tempPassword: null,
      mustResetPassword: false
    });
  }

  const employeeUser = await storage.getUserByUsername("employee");
  if (!employeeUser) {
    const hashedPassword = await bcrypt.hash("employee123", 10);
    await storage.createUser({
      username: "employee",
      password: hashedPassword,
      role: "employee",
      tempPassword: null,
      mustResetPassword: false
    });
  }

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

  const stock = await storage.getStockDetails();
  if (stock.length === 0) {
    const seedStock = [
      {
        brandNumber: "5029",
        brandName: "KINGFISHER ULTRA LAGER BEER",
        size: "650 ml",
        quantityPerCase: 12,
        stockInCases: 18,
        stockInBottles: 11,
        totalStockBottles: 245,
        mrp: "350",
        totalStockValue: "85750",
        breakage: 1,
        remarks: ""
      },
      {
        brandNumber: "261",
        brandName: "TI COURIER NAPOLEON FINEST PURE GRAPE FRENCH BRANDY",
        size: "750 ml",
        quantityPerCase: 12,
        stockInCases: 21,
        stockInBottles: 10,
        totalStockBottles: 283,
        mrp: "440",
        totalStockValue: "124520",
        breakage: 0,
        remarks: ""
      },
      {
        brandNumber: "605",
        brandName: "TI MANSION HOUSE XO BRANDY",
        size: "180 ml",
        quantityPerCase: 48,
        stockInCases: 20,
        stockInBottles: 47,
        totalStockBottles: 1157,
        mrp: "120",
        totalStockValue: "138840",
        breakage: 2,
        remarks: ""
      }
    ];
    await storage.bulkUpdateStockDetails(seedStock);
  }
}
