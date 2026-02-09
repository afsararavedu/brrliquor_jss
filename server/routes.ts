
import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import multer from "multer";
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";

const upload = multer({ storage: multer.memoryStorage() });

const EMPTY_ORDER = {
  brandNumber: "",
  brandName: "",
  productType: "",
  packType: "",
  packSize: "",
  qtyCasesDelivered: 0,
  qtyBottlesDelivered: 0,
  ratePerCase: "0",
  unitRatePerBottle: "0",
  totalAmount: "0",
  breakageBottleQty: 0,
  remarks: "",
  invoiceDate: "",
  icdcNumber: ""
};

const COLUMN_MAP: Record<string, keyof typeof EMPTY_ORDER> = {
  "brand number": "brandNumber",
  "brandnumber": "brandNumber",
  "brand_number": "brandNumber",
  "brand no": "brandNumber",
  "brand no.": "brandNumber",
  "brand name": "brandName",
  "brandname": "brandName",
  "brand_name": "brandName",
  "product type": "productType",
  "producttype": "productType",
  "product_type": "productType",
  "type": "productType",
  "pack type": "packType",
  "packtype": "packType",
  "pack_type": "packType",
  "pack size": "packSize",
  "packsize": "packSize",
  "pack_size": "packSize",
  "pack qty / size (ml)": "packSize",
  "pack qty": "packSize",
  "qty cases delivered": "qtyCasesDelivered",
  "qty cases": "qtyCasesDelivered",
  "cases delivered": "qtyCasesDelivered",
  "cases": "qtyCasesDelivered",
  "qty_cases_delivered": "qtyCasesDelivered",
  "qty bottles delivered": "qtyBottlesDelivered",
  "qty bottles": "qtyBottlesDelivered",
  "bottles delivered": "qtyBottlesDelivered",
  "bottles": "qtyBottlesDelivered",
  "qty_bottles_delivered": "qtyBottlesDelivered",
  "rate per case": "ratePerCase",
  "rate/case": "ratePerCase",
  "rate_per_case": "ratePerCase",
  "unit rate per bottle": "unitRatePerBottle",
  "unit rate": "unitRatePerBottle",
  "rate/bottle": "unitRatePerBottle",
  "unit_rate_per_bottle": "unitRatePerBottle",
  "total amount": "totalAmount",
  "totalamount": "totalAmount",
  "total_amount": "totalAmount",
  "amount": "totalAmount",
  "total": "totalAmount",
  "breakage bottle qty": "breakageBottleQty",
  "breakage": "breakageBottleQty",
  "breakage_bottle_qty": "breakageBottleQty",
  "breakage btl qty": "breakageBottleQty",
  "remarks": "remarks",
  "remark": "remarks",
  "invoice date": "invoiceDate",
  "invoice_date": "invoiceDate",
  "invoicedate": "invoiceDate",
  "icdc number": "icdcNumber",
  "icdc_number": "icdcNumber",
  "icdcnumber": "icdcNumber",
  "icdc no": "icdcNumber",
};

function mapHeaderToField(header: string): keyof typeof EMPTY_ORDER | null {
  const normalized = header.trim().toLowerCase();
  return COLUMN_MAP[normalized] || null;
}

function rowToOrder(row: Record<string, any>, headerMap: Record<string, keyof typeof EMPTY_ORDER>): typeof EMPTY_ORDER {
  const order = { ...EMPTY_ORDER };
  for (const [col, field] of Object.entries(headerMap)) {
    const val = row[col];
    if (val === undefined || val === null || val === "") continue;
    if (field === "qtyCasesDelivered" || field === "qtyBottlesDelivered" || field === "breakageBottleQty") {
      (order as any)[field] = parseInt(String(val)) || 0;
    } else if (field === "ratePerCase" || field === "unitRatePerBottle" || field === "totalAmount") {
      (order as any)[field] = String(val);
    } else {
      (order as any)[field] = String(val);
    }
  }
  return order;
}

function parseSpreadsheet(buffer: Buffer, filename: string) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const jsonRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (jsonRows.length === 0) {
    throw new Error("The file appears to be empty or has no data rows.");
  }

  const headers = Object.keys(jsonRows[0]);
  const headerMap: Record<string, keyof typeof EMPTY_ORDER> = {};
  for (const h of headers) {
    const field = mapHeaderToField(h);
    if (field) {
      headerMap[h] = field;
    }
  }

  if (Object.keys(headerMap).length === 0) {
    const orders: (typeof EMPTY_ORDER)[] = [];
    for (const row of jsonRows) {
      const vals = Object.values(row).map(v => String(v).trim()).filter(Boolean);
      if (vals.length >= 2) {
        orders.push({
          ...EMPTY_ORDER,
          brandNumber: vals[0] || "",
          brandName: vals[1] || "",
          productType: vals[2] || "",
          packType: vals[3] || "",
          packSize: vals[4] || "",
          qtyCasesDelivered: parseInt(vals[5]) || 0,
          qtyBottlesDelivered: parseInt(vals[6]) || 0,
          ratePerCase: vals[7] || "0",
          unitRatePerBottle: vals[8] || "0",
          totalAmount: vals[9] || "0",
          breakageBottleQty: parseInt(vals[10]) || 0,
          remarks: vals[11] || ""
        });
      }
    }
    return orders;
  }

  return jsonRows.map(row => rowToOrder(row, headerMap));
}

async function parsePdfInvoice(buffer: Buffer): Promise<(typeof EMPTY_ORDER)[]> {
  const { PDFParse } = await import("pdf-parse");
  const uint8 = new Uint8Array(buffer);
  const parser = new PDFParse(uint8);
  await (parser as any).load();
  const result = await (parser as any).getText();
  const allText: string = result.pages.map((p: any) => p.text).join("\n");
  const lines = allText.split("\n").map((l: string) => l.replace(/\t/g, " ").trim()).filter(Boolean);

  let invoiceDate = "";
  let icdcNumber = "";
  for (const line of lines) {
    const dateMatch = line.match(/Invoice\s*Date\s*:\s*(.+?)(?:\s{2,}|$)/i);
    if (dateMatch && !invoiceDate) {
      invoiceDate = dateMatch[1].trim();
    }
    const icdcMatch = line.match(/ICDC\s*Number\s*[:\s]\s*(ICDC\S+)/i);
    if (icdcMatch && !icdcNumber) {
      icdcNumber = icdcMatch[1].trim();
    }
    if (!icdcNumber) {
      const standaloneIcdc = line.match(/^(ICDC\d{10,})$/);
      if (standaloneIcdc) {
        icdcNumber = standaloneIcdc[1].trim();
      }
    }
    if (invoiceDate && icdcNumber) break;
  }

  const orders: (typeof EMPTY_ORDER)[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const slNoMatch = line.match(/^(\d+)\s+(\d{3,5})\s+(.+)/);
    if (!slNoMatch) { i++; continue; }

    const brandNumber = slNoMatch[2];
    let rest = slNoMatch[3];

    i++;
    while (i < lines.length && !lines[i].match(/^\d+\s+\d{3,5}\s+/) && !lines[i].match(/^(Duplicate|Original|Total|Grand|Sub|Breakage|Particulars|Sl\.No)/i)) {
      rest += " " + lines[i];
      i++;
    }

    const sizeMatch = rest.match(/(\d+\s*\/\s*\d+\s*ml)/i);
    if (!sizeMatch) continue;

    const packSize = sizeMatch[1].replace(/\s+/g, " ").trim();
    const beforeSize = rest.substring(0, rest.indexOf(sizeMatch[0])).trim();
    const afterSize = rest.substring(rest.indexOf(sizeMatch[0]) + sizeMatch[0].length).trim();

    const typeMatch = beforeSize.match(/^(.+?)\s+(Beer|IML|IMFL|Wine|RTD)\s+([A-Z])\s*$/i);
    let brandName = "", productType = "", packType = "";
    if (typeMatch) {
      brandName = typeMatch[1].trim();
      productType = typeMatch[2].trim();
      packType = typeMatch[3].trim();
    } else {
      const altMatch = beforeSize.match(/^(.+?)\s+([A-Z])\s*$/);
      if (altMatch) {
        brandName = altMatch[1].trim();
        packType = altMatch[2].trim();
      } else {
        brandName = beforeSize;
      }
    }

    const cleanNum = (s: string | undefined) => (s || "0").replace(/,/g, "").trim();
    const nums = afterSize.match(/[\d,]+\.?\d*/g) || [];

    let qtyCases = 0, qtyBottles = 0, ratePerCase = "0", unitRate = "0", totalAmt = "0";
    if (nums.length >= 4) {
      qtyCases = parseInt(cleanNum(nums[0])) || 0;
      qtyBottles = parseInt(cleanNum(nums[1])) || 0;
      ratePerCase = cleanNum(nums[2]);
      unitRate = cleanNum(nums[nums.length - 2]);
      totalAmt = cleanNum(nums[nums.length - 1]);
    } else if (nums.length === 3) {
      qtyCases = parseInt(cleanNum(nums[0])) || 0;
      qtyBottles = 0;
      ratePerCase = cleanNum(nums[1]);
      totalAmt = cleanNum(nums[2]);
    }

    orders.push({
      ...EMPTY_ORDER,
      brandNumber,
      brandName: brandName.replace(/\s+/g, " ").trim(),
      productType,
      packType,
      packSize,
      qtyCasesDelivered: qtyCases,
      qtyBottlesDelivered: qtyBottles,
      ratePerCase,
      unitRatePerBottle: unitRate,
      totalAmount: totalAmt,
      invoiceDate,
      icdcNumber,
    });
  }

  if (orders.length === 0) {
    throw new Error("Could not extract any order data from the PDF. Please ensure it follows the invoice format.");
  }

  return orders;
}

async function parseUploadedFile(buffer: Buffer, filename: string) {
  const ext = filename.toLowerCase().split(".").pop() || "";

  if (ext === "csv" || ext === "xls" || ext === "xlsx") {
    return parseSpreadsheet(buffer, filename);
  } else if (ext === "pdf") {
    return parsePdfInvoice(buffer);
  } else {
    throw new Error(`Unsupported file type: .${ext}. Please upload .csv, .xls, .xlsx, or .pdf files.`);
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
    const invoiceDate = req.query.invoice_date as string | undefined;
    const icdcNumber = req.query.icdc_number as string | undefined;
    const allOrders = await storage.getOrders();
    let filtered = allOrders;
    if (invoiceDate) {
      filtered = filtered.filter(o => o.invoiceDate === invoiceDate);
    }
    if (icdcNumber) {
      filtered = filtered.filter(o => o.icdcNumber === icdcNumber);
    }
    res.json(filtered);
  });

  app.post(api.orders.bulkCreate.path, async (req, res) => {
    try {
      const input = api.orders.bulkCreate.input.parse(req.body);
      const result = await storage.bulkCreateOrders(input);

      const syncResult = await storage.syncOrdersToStock();
      console.log(`Stock sync: ${syncResult.updatedStockCount} stock items updated from ${syncResult.syncedOrderIds.length} orders`);

      const salesSync = await storage.syncStockToDailySales();
      console.log(`Sales sync: ${salesSync.updatedSalesCount} daily sales rows updated from stock`);

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

      const salesSync = await storage.syncStockToDailySales();
      console.log(`Sales sync (from stock update): ${salesSync.updatedSalesCount} daily sales rows updated`);

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
  
  app.get("/api/template/download", (req, res) => {
    const format = (req.query.format as string) || "pdf";
    
    if (format === "pdf") {
      const pdfPath = path.resolve("attached_assets/sample_Invoice_Templates_1770376466401.pdf");
      if (!fs.existsSync(pdfPath)) {
        return res.status(404).json({ message: "Template PDF not found" });
      }
      res.setHeader("Content-Disposition", "attachment; filename=Invoice_Template_Sample.pdf");
      res.setHeader("Content-Type", "application/pdf");
      fs.createReadStream(pdfPath).pipe(res);
      return;
    }

    const sampleData = [
      { "Sl.No.": 1, "Brand Number": "5029", "Brand Name": "KINGFISHER ULTRA LAGER BEER", "Product Type": "Beer", "Pack Type": "G", "Pack Qty / Size (ml)": "12 / 650 ml", "Qty Cases Delivered": 22, "Qty Bottles Delivered": 0, "Rate Per Case": "2201.00", "Unit Rate Per Bottle": "183.42", "Total Amount": "48422.00", "Breakage Btl Qty": 0, "Remarks": "" },
      { "Sl.No.": 2, "Brand Number": "0261", "Brand Name": "TI COURIER NAPOLEON FINEST PURE GRAPE FRENCH BRANDY", "Product Type": "IML", "Pack Type": "G", "Pack Qty / Size (ml)": "12 / 750 ml", "Qty Cases Delivered": 1, "Qty Bottles Delivered": 0, "Rate Per Case": "7501.00", "Unit Rate Per Bottle": "625.08", "Total Amount": "7501.00", "Breakage Btl Qty": 0, "Remarks": "" },
      { "Sl.No.": 3, "Brand Number": "0605", "Brand Name": "TI MANSION HOUSE XO BRANDY", "Product Type": "IML", "Pack Type": "G", "Pack Qty / Size (ml)": "48 / 180 ml", "Qty Cases Delivered": 36, "Qty Bottles Delivered": 0, "Rate Per Case": "5604.00", "Unit Rate Per Bottle": "116.75", "Total Amount": "201744.00", "Breakage Btl Qty": 0, "Remarks": "" },
      { "Sl.No.": 4, "Brand Number": "0605", "Brand Name": "TI MANSION HOUSE XO BRANDY", "Product Type": "IML", "Pack Type": "P", "Pack Qty / Size (ml)": "4 / 2000 ml", "Qty Cases Delivered": 1, "Qty Bottles Delivered": 0, "Rate Per Case": "5501.00", "Unit Rate Per Bottle": "1375.25", "Total Amount": "5501.00", "Breakage Btl Qty": 0, "Remarks": "" },
      { "Sl.No.": 5, "Brand Number": "0110", "Brand Name": "OFFICER'S CHOICE RESERVE WHISKY", "Product Type": "IML", "Pack Type": "G", "Pack Qty / Size (ml)": "48 / 180 ml", "Qty Cases Delivered": 29, "Qty Bottles Delivered": 47, "Rate Per Case": "5204.00", "Unit Rate Per Bottle": "108.42", "Total Amount": "156011.58", "Breakage Btl Qty": 0, "Remarks": "" },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sampleData);
    ws["!cols"] = [
      { wch: 6 }, { wch: 14 }, { wch: 45 }, { wch: 14 }, { wch: 10 },
      { wch: 20 }, { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 20 },
      { wch: 14 }, { wch: 16 }, { wch: 15 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Invoice Template");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", "attachment; filename=Invoice_Template.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buf);
  });

  // Upload
  app.post(api.upload.create.path, upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const allowedExts = [".csv", ".xls", ".xlsx", ".pdf"];
    const ext = "." + (req.file.originalname.toLowerCase().split(".").pop() || "");
    if (!allowedExts.includes(ext)) {
      return res.status(400).json({ message: "Please upload a .csv, .xls, .xlsx, or .pdf file." });
    }

    try {
      const parsedOrders = await parseUploadedFile(req.file.buffer, req.file.originalname);
      res.json({ 
        message: `Successfully parsed ${parsedOrders.length} orders from file. Please review and confirm before saving.`, 
        filename: req.file.originalname,
        orders: parsedOrders,
        ordersCount: parsedOrders.length
      });
    } catch (err: any) {
      res.status(500).json({ message: "Failed to parse file: " + err.message });
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
