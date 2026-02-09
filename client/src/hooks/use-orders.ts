import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type InsertOrder } from "@shared/schema";

export function useOrders(filters?: { invoiceDate?: string; icdcNumber?: string }) {
  const params = new URLSearchParams();
  if (filters?.invoiceDate) params.set("invoice_date", filters.invoiceDate);
  if (filters?.icdcNumber) params.set("icdc_number", filters.icdcNumber);
  const queryString = params.toString();
  const url = queryString ? `${api.orders.list.path}?${queryString}` : api.orders.list.path;

  return useQuery({
    queryKey: [api.orders.list.path, filters?.invoiceDate || "", filters?.icdcNumber || ""],
    queryFn: async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch orders");
      return api.orders.list.responses[200].parse(await res.json());
    },
  });
}

export function useBulkCreateOrders() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertOrder[]) => {
      const res = await fetch(api.orders.bulkCreate.path, {
        method: api.orders.bulkCreate.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        if (res.status === 400) {
           const error = api.orders.bulkCreate.responses[400].parse(await res.json());
           throw new Error(error.message);
        }
        throw new Error("Failed to create orders");
      }
      return api.orders.bulkCreate.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.orders.list.path] });
    },
  });
}

export function useUploadFile() {
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch(api.upload.create.path, {
        method: api.upload.create.method,
        body: formData, // FormData automatically sets the correct Content-Type boundary
      });

      if (!res.ok) throw new Error("Failed to upload file");
      return api.upload.create.responses[200].parse(await res.json());
    },
  });
}
