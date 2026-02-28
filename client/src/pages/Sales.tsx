import { useState, useEffect, useCallback } from "react";
import { useSales, useBulkUpdateSales } from "@/hooks/use-sales";
import {
  Search,
  Save,
  Loader2,
  Download,
  RefreshCw,
  Store,
} from "lucide-react";
import { type DailySale, type ShopDetail } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { PaginationCustom } from "@/components/ui/pagination-custom";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";

interface SalesSummary {
  openingBalanceValue: number;
  newStockValue: number;
  soldStockValue: number;
  closingBalanceValue: number;
  categories: Record<string, { opening: number; newStock: number; sold: number; closing: number }>;
}

export default function Sales() {
  const { data: sales, isLoading } = useSales();
  const { mutate: updateSales, isPending: isSaving } = useBulkUpdateSales();
  const { toast } = useToast();
  const [localSales, setLocalSales] = useState<DailySale[]>([]);

  const { data: shopDetails } = useQuery<ShopDetail[]>({
    queryKey: ["/api/shop-details"],
  });

  const { data: summary } = useQuery<SalesSummary>({
    queryKey: ["/api/sales/summary"],
  });

  const { mutate: syncFromStock, isPending: isSyncing } = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/sales/sync-from-stock");
      return res.json();
    },
    onSuccess: (data: { updatedSalesCount: number; createdSalesCount: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      toast({
        title: "Stock Synced to Sales",
        description: `${data.updatedSalesCount} rows updated, ${data.createdSalesCount} new rows created from stock.`,
        className: "bg-green-50 border-green-200 text-green-800",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Sync Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const handleExportCSV = useCallback(() => {
    if (!localSales || localSales.length === 0) return;

    try {
      const headers = [
        "SNo", "Brand No", "Brand Name", "Size", "Qty/Case", 
        "Opening Bal (Btls)", "New Stock (Cs)", "New Stock (Btls)", 
        "Total Stock", "Closing Bal (Cs)", "Closing Bal (Btls)", 
        "Sold Bottles", "MRP", "Sale Value", "Breakage", 
        "Total Closing Stock", "Final Closing Bal"
      ];

      const csvContent = [
        headers.join(","),
        ...localSales.map((item, idx) => {
          const totalStock = (item.openingBalanceBottles || 0) + ((item.quantityPerCase || 0) * (item.newStockCases || 0)) + (item.newStockBottles || 0);
          return [
            idx + 1,
            `"${item.brandNumber}"`,
            `"${item.brandName}"`,
            `"${item.size}"`,
            item.quantityPerCase,
            item.openingBalanceBottles,
            item.newStockCases,
            item.newStockBottles,
            totalStock,
            item.closingBalanceCases,
            item.closingBalanceBottles,
            item.soldBottles,
            item.mrp,
            item.saleValue,
            item.breakageBottles,
            item.totalClosingStock,
            item.finalClosingBalance
          ].join(",");
        })
      ].join("\n");

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `sales_report_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export Successful",
        description: "Sales data has been exported to CSV.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "There was an error exporting the data.",
        variant: "destructive",
      });
    }
  }, [localSales, toast]);

  // Sync local state when data loads
  useEffect(() => {
    if (sales) {
      setLocalSales(sales);
    }
  }, [sales]);

  const handleInputChange = (
    id: number,
    field: keyof DailySale,
    value: string,
  ) => {
    const numValue =
      field === "mrp" ? value : value === "" ? 0 : parseInt(value, 10);
    setLocalSales((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: numValue };

          // Recalculate Total Sale Value
          // Formula: ((Op. Bal (Btls) + Qty/Case * New Stock (Cs)) + New Stock (Btls) - (Qty/Case * Closing (Cs) + Closing (Btls))) * MRP
          const opBalBtls = updatedItem.openingBalanceBottles || 0;
          const qtyPerCase = updatedItem.quantityPerCase || 0;
          const newStockCs = updatedItem.newStockCases || 0;
          const newStockBtls = updatedItem.newStockBottles || 0;
          const closingCs = updatedItem.closingBalanceCases || 0;
          const closingBtls = updatedItem.closingBalanceBottles || 0;
          const mrp = parseFloat(updatedItem.mrp as string) || 0;
          const breakage = updatedItem.breakageBottles || 0;

          const totalStock = opBalBtls + (qtyPerCase * newStockCs) + newStockBtls;
          const closingTotal = closingBtls + (closingCs * qtyPerCase);
          const soldBottles = totalStock - closingTotal;

          const saleValue = soldBottles * mrp;
          const totalClosingStock = closingTotal;
          const finalClosingBalance = totalClosingStock * mrp;

          return {
            ...updatedItem,
            soldBottles,
            saleValue: saleValue.toFixed(2),
            totalSaleValue: saleValue.toFixed(2),
            totalClosingStock,
            finalClosingBalance: finalClosingBalance.toFixed(2),
          };
        }
        return item;
      }),
    );
  };

  const handleSave = () => {
    const negativeItems = localSales.filter((item) => (item.soldBottles || 0) < 0);
    if (negativeItems.length > 0) {
      const names = negativeItems.map((item) => `${item.brandName} (${item.size})`).join(", ");
      toast({
        title: "Warning: Negative Sold Bottles",
        description: `The following items have negative sold bottles: ${names}. Please check closing balance values before saving.`,
        variant: "destructive",
        duration: 8000,
      });
      return;
    }

    updateSales(localSales, {
      onSuccess: () => {
        toast({
          title: "Sales Updated",
          description: "Daily sales data has been successfully updated.",
          className: "bg-green-50 border-green-200 text-green-800",
        });
      },
      onError: (err) => {
        toast({
          title: "Error",
          description: err.message,
          variant: "destructive",
        });
      },
    });
  };

  const filteredSales = localSales.filter(
    (item) =>
      item.brandName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.brandNumber.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const totalPages = Math.ceil(filteredSales.length / pageSize);
  const paginatedSales = filteredSales.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const formatCurrency = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
    return `₹${val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const shopName = shopDetails?.[0]?.name || "Shop Name";

  const cats = summary?.categories || {};
  const imlCount = (field: keyof typeof cats[string]) =>
    (cats["IML"]?.[field] || 0) + (cats["IMFL"]?.[field] || 0);
  const beerCount = (field: keyof typeof cats[string]) =>
    cats["Beer"]?.[field] || 0;

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Shop Name */}
      <div className="flex items-center gap-3" data-testid="text-shop-name">
        <Store className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-xl font-semibold text-foreground">{shopName}</h2>
      </div>

      {/* Value Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm" data-testid="card-opening-balance-value">
          <p className="text-xs font-medium text-muted-foreground mb-1">Opening Balance Value</p>
          <p className="text-lg font-bold text-foreground">{formatCurrency(summary?.openingBalanceValue || 0)}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm" data-testid="card-new-stock-value">
          <p className="text-xs font-medium text-muted-foreground mb-1">New Stock Value</p>
          <p className="text-lg font-bold text-foreground">{formatCurrency(summary?.newStockValue || 0)}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm" data-testid="card-sold-stock-value">
          <p className="text-xs font-medium text-muted-foreground mb-1">Sold Stock Value</p>
          <div className="flex items-center gap-3">
            <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded dark:bg-blue-900/30 dark:text-blue-300">IML</span>
            <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded dark:bg-amber-900/30 dark:text-amber-300">Beer</span>
          </div>
          <p className="text-lg font-bold text-foreground mt-1">{formatCurrency(summary?.soldStockValue || 0)}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm" data-testid="card-closing-balance-value">
          <p className="text-xs font-medium text-muted-foreground mb-1">Closing Balance Value</p>
          <p className="text-lg font-bold text-foreground">{formatCurrency(summary?.closingBalanceValue || 0)}</p>
        </div>
      </div>

      {/* Stock Count Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm" data-testid="card-opening-stock">
          <p className="text-xs font-medium text-muted-foreground mb-2">opening Stock in bottles</p>
          <div className="space-y-1 text-sm font-semibold text-foreground">
            <p>IML - {imlCount("opening").toLocaleString()}</p>
            <p>Beer - {beerCount("opening").toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm" data-testid="card-new-stock">
          <p className="text-xs font-medium text-muted-foreground mb-2">New Stock in bottles</p>
          <div className="space-y-1 text-sm font-semibold text-foreground">
            <p>IML - {imlCount("newStock").toLocaleString()}</p>
            <p>Beer - {beerCount("newStock").toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm" data-testid="card-sold-stock">
          <p className="text-xs font-medium text-muted-foreground mb-2">Sold Stock in bottles</p>
          <div className="space-y-1 text-sm font-semibold text-foreground">
            <p>IML - {imlCount("sold").toLocaleString()}</p>
            <p>Beer - {beerCount("sold").toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm" data-testid="card-closing-stock">
          <p className="text-xs font-medium text-muted-foreground mb-2">Closing Stock in bottles</p>
          <div className="space-y-1 text-sm font-semibold text-foreground">
            <p>IML - {imlCount("closing").toLocaleString()}</p>
            <p>Beer - {beerCount("closing").toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 justify-between items-center bg-card">
          <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                placeholder="Search by brand name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-sales"
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>
            <button
              onClick={() => syncFromStock()}
              disabled={isSyncing}
              data-testid="button-sync-stock-to-sales"
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-xl font-medium shadow-md hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isSyncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Get Stock into Sales
            </button>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleExportCSV}
              data-testid="button-export-csv"
              className="flex items-center gap-2 px-6 py-2 bg-secondary text-secondary-foreground rounded-xl font-medium border border-border hover:bg-secondary/80 transition-all"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving}
              data-testid="button-save-sales"
              className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-xl font-medium shadow-lg shadow-primary/25 hover:bg-primary/90 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Sales
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto table-typography">
          <table className="w-full">
            <thead>
              <tr className="bg-secondary/30">
                <th className="table-header w-8 border-r border-border">SNo</th>
                <th className="table-header w-14 border-r border-border">Brand No</th>
                <th className="table-header w-24 border-r border-border">Brand Name</th>
                <th className="table-header w-12 border-r border-border">Size</th>
                <th className="table-header w-10 border-r border-border">Qty/Cs</th>
                <th className="table-header w-14 border-r border-border">Op. Bal (Btls)</th>
                <th className="table-header w-16 text-right bg-green-50/50 border-r border-border">New Stk (Cs)</th>
                <th className="table-header w-16 text-right bg-green-50/50 border-r border-border">New Stk (Btls)</th>
                <th className="table-header w-14 text-right border-r border-border">Total Stk</th>
                <th className="table-header w-20 text-center bg-orange-50/80 border-l border-orange-100 font-bold text-orange-900 border-r border-border">
                  Cls Bal (Cs)
                </th>
                <th className="table-header w-20 text-center bg-orange-50/80 font-bold text-orange-900 border-r border-border">
                  Cls Bal (Btls)
                </th>
                <th className="table-header w-14 text-center border-r border-border">Sold Btls</th>
                <th className="table-header w-14 text-center border-r border-border">MRP</th>
                <th className="table-header w-20 text-right font-bold text-primary border-r border-border">Sale Value</th>
                <th className="table-header w-14 text-center border-r border-border">Breakage</th>
                <th className="table-header w-16 text-center border-r border-border">Tot Cls Stk</th>
                <th className="table-header w-20 text-center">Final Cls Bal</th>
              </tr>
            </thead>
            <tbody>
              {paginatedSales.length === 0 ? (
                <tr>
                  <td
                    colSpan={17}
                    className="py-12 text-center text-muted-foreground"
                  >
                    No sales records found matching "{searchTerm}"
                  </td>
                </tr>
              ) : (
                paginatedSales.map((item, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx;
                  const totalStock = (item.openingBalanceBottles || 0) + ((item.quantityPerCase || 0) * (item.newStockCases || 0)) + (item.newStockBottles || 0);
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      <td className="table-cell font-mono text-xs text-muted-foreground border-r border-border">
                        {globalIdx + 1}
                      </td>
                      <td className="table-cell font-mono text-xs text-muted-foreground border-r border-border">
                        {item.brandNumber}
                      </td>
                      <td className="table-cell font-medium border-r border-border">{item.brandName}</td>
                      <td className="table-cell text-muted-foreground border-r border-border">
                        {item.size}
                      </td>
                      <td className="table-cell text-muted-foreground border-r border-border">
                        {item.quantityPerCase}
                      </td>
                      <td className="table-cell text-right font-mono text-muted-foreground bg-blue-50/10 group-hover:bg-blue-50/30 border-r border-border">
                        {item.openingBalanceBottles}
                      </td>
                      <td className="table-cell text-right font-mono text-muted-foreground bg-green-50/10 group-hover:bg-green-50/30 border-r border-border">
                        {item.newStockCases}
                      </td>
                      <td className="table-cell text-right font-mono text-muted-foreground bg-green-50/10 group-hover:bg-green-50/30 border-r border-border">
                        {item.newStockBottles}
                      </td>
                      <td className="table-cell text-right font-mono text-muted-foreground border-r border-border">
                        {totalStock}
                      </td>
                      <td className="table-cell p-1 bg-orange-50/30 border-r border-border">
                        <input
                          type="number"
                          min="0"
                          value={item.closingBalanceCases || 0}
                          onChange={(e) =>
                            handleInputChange(
                              item.id,
                              "closingBalanceCases",
                              e.target.value,
                            )
                          }
                          className="w-full text-center p-1 rounded-md border border-orange-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none font-bold text-foreground bg-white shadow-sm"
                        />
                      </td>
                      <td className="table-cell p-1 bg-orange-50/30 border-r border-border">
                        <input
                          type="number"
                          min="0"
                          value={item.closingBalanceBottles || 0}
                          onChange={(e) =>
                            handleInputChange(
                              item.id,
                              "closingBalanceBottles",
                              e.target.value,
                            )
                          }
                          className="w-full text-center p-1 rounded-md border border-orange-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none font-bold text-foreground bg-white shadow-sm"
                        />
                      </td>
                      <td className={`table-cell text-center font-mono border-r border-border ${(item.soldBottles || 0) < 0 ? 'bg-red-100 text-red-700 font-bold dark:bg-red-900/30 dark:text-red-400' : ''}`}>
                        {item.soldBottles}
                        {(item.soldBottles || 0) < 0 && <span className="block text-[9px] text-red-500">⚠ negative</span>}
                      </td>
                      <td className="table-cell text-center font-mono bg-blue-50/10 group-hover:bg-blue-50/30 border-r border-border">
                        {item.mrp || 0}
                      </td>
                      <td className={`table-cell text-right font-bold font-mono border-r border-border ${parseFloat(item.saleValue as string || '0') < 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : 'text-primary'}`}>
                        {parseFloat(item.saleValue as string || '0') < 0 && <span className="mr-1">⚠</span>}
                        ₹{item.saleValue}
                      </td>
                      <td className="table-cell p-1 border-r border-border">
                        <input
                          type="number"
                          min="0"
                          value={item.breakageBottles || 0}
                          onChange={(e) =>
                            handleInputChange(item.id, "breakageBottles", e.target.value)
                          }
                          className="w-full text-center p-1 rounded-md border border-input focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                      </td>
                      <td className="table-cell text-center font-mono border-r border-border">
                        {item.totalClosingStock}
                      </td>
                      <td className="table-cell text-center font-mono">
                        {parseFloat(item.finalClosingBalance as string || '0').toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
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
          totalItems={filteredSales.length}
        />

        <div className="p-4 border-t border-border bg-secondary/20 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-xl font-bold shadow-lg shadow-primary/25 hover:bg-primary/90 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Sales Data"}
          </button>
        </div>
      </div>
    </div>
  );
}
