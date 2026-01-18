import { useState, useEffect, useCallback } from "react";
import { useSales, useBulkUpdateSales } from "@/hooks/use-sales";
import { StatCard } from "@/components/StatCard";
import {
  DollarSign,
  PackageCheck,
  TrendingUp,
  Archive,
  Search,
  Save,
  Loader2,
  Download,
} from "lucide-react";
import { type DailySale } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function Sales() {
  const { data: sales, isLoading } = useSales();
  const { mutate: updateSales, isPending: isSaving } = useBulkUpdateSales();
  const { toast } = useToast();
  const [localSales, setLocalSales] = useState<DailySale[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

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

          // Calculations based on screenshot and common sense
          // Sold Bottles = (Op Bal + New Stock) - (Closing Bal + Breakage)
          const totalIn = opBalBtls + (qtyPerCase * newStockCs) + newStockBtls;
          const totalOut = (qtyPerCase * closingCs) + closingBtls + breakage;
          const soldBottles = Math.max(0, totalIn - totalOut);
          
          const saleValue = soldBottles * mrp;
          const totalClosingStock = (qtyPerCase * closingCs) + closingBtls;
          const finalClosingBalance = totalClosingStock; // As per the prompt's request for these names

          return {
            ...updatedItem,
            soldBottles,
            saleValue: saleValue.toFixed(2),
            totalSaleValue: saleValue.toFixed(2),
            totalClosingStock,
            finalClosingBalance,
          };
        }
        return item;
      }),
    );
  };

  const handleSave = () => {
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

  // Calculate totals for cards
  const totalSalesValue = localSales.reduce(
    (acc, curr) => acc + parseFloat(curr.totalSaleValue || "0"),
    0,
  );
  const closingStockValue = localSales.reduce(
    (acc, curr) => acc + curr.closingBalanceCases! * parseFloat(curr.mrp),
    0,
  );

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <StatCard
          title="Opening Balance"
          value="₹ 12.4M"
          icon={DollarSign}
          trend="+2.5%"
          trendUp={true}
        />
        <StatCard
          title="New Stock / Indent"
          value="₹ 4.2M"
          icon={PackageCheck}
        />
        <StatCard
          title="Sales Value"
          value={`₹ ${(totalSalesValue / 1000000).toFixed(2)}M`}
          icon={TrendingUp}
          className="border-primary/20 bg-primary/5"
        />
        <StatCard
          title="Closing Value"
          value={`₹ ${(closingStockValue / 1000000).toFixed(2)}M`}
          icon={DollarSign}
        />
        <StatCard title="Closing Stock" value="1,240 Cs" icon={Archive} />
      </div>

      {/* Main Content Card */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 justify-between items-center bg-card">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              placeholder="Search by brand name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-6 py-2 bg-secondary text-secondary-foreground rounded-xl font-medium border border-border hover:bg-secondary/80 transition-all"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving}
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px]">
            <thead>
              <tr className="bg-secondary/30">
                <th className="table-header w-24 border-r border-border h-12">SNo</th>
                <th className="table-header w-24 border-r border-border h-12">Brand No</th>
                <th className="table-header border-r border-border h-12">Brand Name</th>
                <th className="table-header w-24 border-r border-border h-12">Size</th>
                <th className="table-header w-24 border-r border-border h-12">Quantity In Case</th>
                <th className="table-header w-24 border-r border-border h-12">Opening Balance (Bottles)</th>
                <th className="table-header w-32 text-right bg-green-50/50 border-r border-border h-12">New Stock (Cases)</th>
                <th className="table-header w-32 text-right bg-green-50/50 border-r border-border h-12">New Stock (Bottles)</th>
                <th className="table-header w-32 text-right border-r border-border h-12">Total Stock</th>
                <th className="table-header w-36 text-center bg-orange-50/80 border-l border-orange-100 font-bold text-orange-900 border-r border-border h-12">
                  Closing Balance (Cases)
                </th>
                <th className="table-header w-36 text-center bg-orange-50/80 font-bold text-orange-900 border-r border-border h-12">
                  Closing Balance (Bottles)
                </th>
                <th className="table-header w-24 text-center border-r border-border h-12">Sold Bottles</th>
                <th className="table-header w-32 text-center border-r border-border h-12"> MRP </th>
                <th className="table-header w-32 text-right font-bold text-primary border-r border-border h-12"> Sale Value </th>
                <th className="table-header w-24 text-center border-r border-border h-12">Breakage Bottles</th>
                <th className="table-header w-32 text-center border-r border-border h-12">Total Closing Stock (Bottles)</th>
                <th className="table-header w-32 text-center h-12">Final Closing Balance (in Bottles)</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr>
                  <td
                    colSpan={17}
                    className="py-12 text-center text-muted-foreground"
                  >
                    No sales records found matching "{searchTerm}"
                  </td>
                </tr>
              ) : (
                filteredSales.map((item, idx) => {
                  const totalStock = (item.openingBalanceBottles || 0) + ((item.quantityPerCase || 0) * (item.newStockCases || 0)) + (item.newStockBottles || 0);
                  return (
                  <tr
                    key={item.id}
                    className="hover:bg-muted/30 transition-colors group"
                  >
                    <td className="table-cell font-mono text-xs text-muted-foreground border-r border-border h-12">
                      {idx + 1}
                    </td>
                    <td className="table-cell font-mono text-xs text-muted-foreground border-r border-border h-12">
                      {item.brandNumber}
                    </td>
                    <td className="table-cell font-medium border-r border-border h-12">{item.brandName}</td>
                    <td className="table-cell text-muted-foreground border-r border-border h-12">
                      {item.size}
                    </td>
                    <td className="table-cell text-muted-foreground border-r border-border h-12">
                      {item.quantityPerCase}
                    </td>
                    <td className="table-cell text-right font-mono text-muted-foreground bg-blue-50/10 group-hover:bg-blue-50/30 border-r border-border h-12">
                      {item.openingBalanceBottles}
                    </td>
                    <td className="table-cell text-right font-mono text-muted-foreground bg-green-50/10 group-hover:bg-green-50/30 border-r border-border h-12">
                      {item.newStockCases}
                    </td>
                    <td className="table-cell text-right font-mono text-muted-foreground bg-green-50/10 group-hover:bg-green-50/30 border-r border-border h-12">
                      {item.newStockBottles}
                    </td>
                    <td className="table-cell text-right font-mono text-muted-foreground border-r border-border h-12">
                      {totalStock}
                    </td>
                    <td className="table-cell p-2 bg-orange-50/30 border-r border-border h-12">
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
                        className="w-full text-center p-1.5 rounded-md border border-orange-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none font-bold text-foreground bg-white shadow-sm"
                      />
                    </td>
                    <td className="table-cell p-2 bg-orange-50/30 border-r border-border h-12">
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
                        className="w-full text-center p-1.5 rounded-md border border-orange-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none font-bold text-foreground bg-white shadow-sm"
                      />
                    </td>
                    <td className="table-cell text-center font-mono border-r border-border h-12">
                      {item.soldBottles}
                    </td>
                    <td className="table-cell text-center font-mono bg-blue-50/10 group-hover:bg-blue-50/30 border-r border-border h-12">
                      {item.mrp || 0}
                    </td>
                    <td className="table-cell text-right font-bold text-primary font-mono border-r border-border h-12">
                      ₹{item.saleValue}
                    </td>
                    <td className="table-cell p-2 border-r border-border h-12">
                      <input
                        type="number"
                        min="0"
                        value={item.breakageBottles || 0}
                        onChange={(e) =>
                          handleInputChange(item.id, "breakageBottles", e.target.value)
                        }
                        className="w-full text-center p-1.5 rounded-md border border-input focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                      />
                    </td>
                    <td className="table-cell text-center font-mono border-r border-border h-12">
                      {item.totalClosingStock}
                    </td>
                    <td className="table-cell text-center font-mono h-12">
                      {item.finalClosingBalance}
                    </td>
                  </tr>
                );})
              )}
            </tbody>
          </table>
        </div>

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
