import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type StockDetail, type InsertStockDetail } from "@shared/schema";
import { StatCard } from "@/components/StatCard";
import {
  Package,
  Boxes,
  TrendingUp,
  AlertTriangle,
  Search,
  Save,
  Loader2,
  Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PaginationCustom } from "@/components/ui/pagination-custom";

export default function Stock() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [localStock, setLocalStock] = useState<StockDetail[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: stock, isLoading } = useQuery<StockDetail[]>({
    queryKey: [api.stock.list.path],
    queryFn: async () => {
      const res = await fetch(api.stock.list.path);
      if (!res.ok) throw new Error("Failed to fetch stock data");
      return await res.json();
    },
  });

  const { mutate: updateStock, isPending: isSaving } = useMutation({
    mutationFn: async (data: InsertStockDetail[]) => {
      const res = await fetch(api.stock.bulkUpdate.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update stock");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.stock.list.path] });
      toast({ title: "Stock Updated", description: "Stock data has been successfully saved." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (stock) setLocalStock(stock);
  }, [stock]);

  const handleInputChange = (id: number, field: keyof StockDetail, value: string) => {
    setLocalStock((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value === "" ? 0 : value };
          
          if (["stockInCases", "stockInBottles", "quantityPerCase", "mrp", "breakage"].includes(field)) {
            const cases = Number(updatedItem.stockInCases) || 0;
            const bottles = Number(updatedItem.stockInBottles) || 0;
            const qtyPerCase = Number(updatedItem.quantityPerCase) || 0;
            const mrp = parseFloat(updatedItem.mrp as string) || 0;
            
            const totalBottles = (cases * qtyPerCase) + bottles;
            const totalValue = totalBottles * mrp;
            
            return {
              ...updatedItem,
              totalStockBottles: totalBottles,
              totalStockValue: totalValue.toFixed(2),
            };
          }
          return updatedItem;
        }
        return item;
      })
    );
  };

  const filteredStock = localStock.filter(
    (item) =>
      item.brandName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.brandNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredStock.length / pageSize);
  const paginatedStock = filteredStock.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totalValue = localStock.reduce((acc, curr) => acc + parseFloat(curr.totalStockValue || "0"), 0);
  const totalBottles = localStock.reduce((acc, curr) => acc + (curr.totalStockBottles || 0), 0);
  const totalBreakage = localStock.reduce((acc, curr) => acc + (curr.breakage || 0), 0);

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Stock Value" value={`₹ ${(totalValue / 100000).toFixed(2)}L`} icon={TrendingUp} trend="+3.2%" trendUp={true} />
        <StatCard title="Total Bottles" value={totalBottles.toLocaleString()} icon={Package} />
        <StatCard title="Total Cases" value={Math.floor(totalBottles / 12).toLocaleString()} icon={Boxes} />
        <StatCard title="Total Breakage" value={totalBreakage.toString()} icon={AlertTriangle} />
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 justify-between items-center bg-card">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              placeholder="Search stock..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>
          <button
            onClick={() => updateStock(localStock as any)}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-xl font-medium shadow-lg hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Get Latest Stock
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px]">
            <thead>
              <tr className="bg-secondary/30">
                <th className="table-header w-16">SNo</th>
                <th className="table-header w-24">Brand No</th>
                <th className="table-header">Brand Name</th>
                <th className="table-header w-24">Size</th>
                <th className="table-header w-24">Qty/Case</th>
                <th className="table-header w-32 bg-blue-50/50">Stock (Cases)</th>
                <th className="table-header w-32 bg-blue-50/50">Stock (Btls)</th>
                <th className="table-header w-32">Total Stock (Btls)</th>
                <th className="table-header w-32">MRP</th>
                <th className="table-header w-40 font-bold text-primary bg-primary/5">Stock Value</th>
                <th className="table-header w-24">Breakage</th>
                <th className="table-header w-48">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {paginatedStock.map((item, idx) => {
                const globalIdx = (currentPage - 1) * pageSize + idx;
                return (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="table-cell text-center font-mono text-xs text-muted-foreground">{globalIdx + 1}</td>
                    <td className="table-cell font-mono text-xs text-muted-foreground">{item.brandNumber}</td>
                    <td className="table-cell font-medium">{item.brandName}</td>
                    <td className="table-cell text-muted-foreground">{item.size}</td>
                    <td className="table-cell text-center">{item.quantityPerCase}</td>
                    <td className="table-cell text-right font-mono bg-blue-50/10 group-hover:bg-blue-50/30">
                      {item.stockInCases || 0}
                    </td>
                    <td className="table-cell text-right font-mono bg-blue-50/10 group-hover:bg-blue-50/30">
                      {item.stockInBottles || 0}
                    </td>
                    <td className="table-cell text-right font-mono">{item.totalStockBottles}</td>
                    <td className="table-cell text-right font-mono">₹{item.mrp}</td>
                    <td className="table-cell text-right font-bold text-primary font-mono bg-primary/5">₹{item.totalStockValue}</td>
                    <td className="p-2 border-b border-border">
                      <input
                        type="number"
                        value={item.breakage || 0}
                        onChange={(e) => handleInputChange(item.id, "breakage", e.target.value)}
                        className="w-full text-right p-1.5 rounded-md border border-input focus:ring-2 focus:ring-primary/20 outline-none font-mono"
                      />
                    </td>
                    <td className="p-2 border-b border-border">
                      <input
                        type="text"
                        value={item.remarks || ""}
                        onChange={(e) => handleInputChange(item.id, "remarks", e.target.value)}
                        className="w-full p-1.5 rounded-md border border-input focus:ring-2 focus:ring-primary/20 outline-none text-sm"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-muted/50 font-bold">
                <td colSpan={5} className="table-cell text-right">Total</td>
                <td className="table-cell text-right">{localStock.reduce((acc, curr) => acc + (curr.stockInCases || 0), 0)}</td>
                <td className="table-cell text-right">{localStock.reduce((acc, curr) => acc + (curr.stockInBottles || 0), 0)}</td>
                <td className="table-cell text-right">{totalBottles}</td>
                <td className="table-cell"></td>
                <td className="table-cell text-right text-primary">₹{totalValue.toFixed(2)}</td>
                <td className="table-cell text-right">{totalBreakage}</td>
                <td className="table-cell"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <PaginationCustom
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          totalItems={filteredStock.length}
        />
      </div>
    </div>
  );
}
