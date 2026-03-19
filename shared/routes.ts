
import { z } from 'zod';
import { insertDailySaleSchema, insertOrderSchema, insertStockDetailSchema, dailySales, orders, stockDetails } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  sales: {
    list: {
      method: 'GET' as const,
      path: '/api/sales',
      responses: {
        200: z.array(z.custom<typeof dailySales.$inferSelect>()),
      },
    },
    bulkUpdate: {
      method: 'POST' as const,
      path: '/api/sales/bulk',
      input: z.array(insertDailySaleSchema),
      responses: {
        201: z.array(z.custom<typeof dailySales.$inferSelect>()),
        400: errorSchemas.validation,
      },
    },
    syncFromStock: {
      method: 'POST' as const,
      path: '/api/sales/sync-from-stock',
      responses: {
        200: z.object({
          updatedSalesCount: z.number(),
          createdSalesCount: z.number(),
        }),
      },
    },
    submit: {
      method: 'POST' as const,
      path: '/api/sales/submit',
      input: z.object({ date: z.string() }),
      responses: {
        200: z.object({ submittedCount: z.number() }),
        400: z.object({ message: z.string() }),
      },
    },
    isSubmitted: {
      method: 'GET' as const,
      path: '/api/sales/is-submitted',
      responses: {
        200: z.object({ isSubmitted: z.boolean() }),
      },
    },
  },
  orders: {
    list: {
      method: 'GET' as const,
      path: '/api/orders',
      responses: {
        200: z.array(z.custom<typeof orders.$inferSelect>()),
      },
    },
    bulkCreate: {
      method: 'POST' as const,
      path: '/api/orders/bulk',
      input: z.array(insertOrderSchema),
      responses: {
        201: z.array(z.custom<typeof orders.$inferSelect>()),
        400: errorSchemas.validation,
      },
    },
  },
  stock: {
    list: {
      method: 'GET' as const,
      path: '/api/stock',
      responses: {
        200: z.array(z.custom<typeof stockDetails.$inferSelect>()),
      },
    },
    bulkUpdate: {
      method: 'POST' as const,
      path: '/api/stock/bulk',
      input: z.array(insertStockDetailSchema),
      responses: {
        201: z.array(z.custom<typeof stockDetails.$inferSelect>()),
        400: errorSchemas.validation,
      },
    },
    sync: {
      method: 'POST' as const,
      path: '/api/stock/sync',
      responses: {
        200: z.object({
          syncedOrderIds: z.array(z.number()),
          updatedStockCount: z.number(),
        }),
      },
    },
  },
  upload: {
    create: {
      method: 'POST' as const,
      path: '/api/upload',
      // Multipart form data, not strictly validated by zod in body
      responses: {
        200: z.object({ message: z.string(), filename: z.string(), orders: z.array(z.any()).optional(), ordersCount: z.number().optional() }),
      },
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
