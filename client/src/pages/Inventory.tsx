import { useState, useRef } from "react";
import { useOrders, useBulkCreateOrders, useUploadFile } from "@/hooks/use-orders";
import { useToast } from "@/hooks/use-toast";
import { 
  UploadCloud, 
  File, 
  Plus, 
  Trash2, 
  Save, 
  Loader2,
  FileSpreadsheet
} from "lucide-react";
import { type InsertOrder } from "@shared/schema";
import { cn } from "@/lib/utils";
import { PaginationCustom } from "@/components/ui/pagination-custom";

// Dropdown Options
const PRODUCT_TYPES = ["Beer", "IML", "Wine"];
const PACK_TYPES = ["G", "P", "Can"];
const PACK_SIZES = [
  "12 / 650 ml", 
  "12 / 750 ml", 
  "48 / 180 ml", 
  "4 / 2000 ml", 
  "96 / 90 ml", 
  "9 / 1000 ml", 
  "24 / 375 ml"
];

const EMPTY_ROW: InsertOrder = {
  brandNumber: "",
  brandName: "",
  productType: "Beer",
  packType: "G",
  packSize: "12 / 650 ml",
  qtyCasesDelivered: 0,
  qtyBottlesDelivered: 0,
  ratePerCase: "0",
  unitRatePerBottle: "0",
  totalAmount: "0",
  breakageBottleQty: 0,
  remarks: "",
};

export default function Inventory() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // File Upload State
  const { mutate: uploadFile, isPending: isUploading } = useUploadFile();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Orders Table State
  const { mutate: saveOrders, isPending: isSaving } = useBulkCreateOrders();
  const [rows, setRows] = useState<InsertOrder[]>([{ ...EMPTY_ROW }]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalPages = Math.ceil(rows.length / pageSize);
  const paginatedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // --- Handlers for File Upload ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    const formData = new FormData();
    formData.append("file", selectedFile);
    
    uploadFile(formData, {
      onSuccess: (data: any) => {
        toast({
          title: "File Parsed",
          description: `${data.ordersCount} items extracted. Review them in the table below and click 'Save Orders' to confirm.`,
          className: "bg-blue-50 text-blue-800 border-blue-200"
        });
        
        if (data.orders && data.orders.length > 0) {
          // Map to match InsertOrder structure exactly if needed
          const newOrders = data.orders.map((o: any) => ({
            ...EMPTY_ROW,
            ...o
          }));
          setRows(newOrders);
          setCurrentPage(1);
        }
        
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
      onError: () => {
        toast({ 
          title: "Upload Failed", 
          description: "Could not upload the file.", 
          variant: "destructive" 
        });
      }
    });
  };

  // --- Handlers for Order Form ---
  const handleRowChange = (index: number, field: keyof InsertOrder, value: any) => {
    const globalIndex = (currentPage - 1) * pageSize + index;
    const newRows = [...rows];
    newRows[globalIndex] = { ...newRows[globalIndex], [field]: value };
    
    // Auto-calculate Total
    if (['qtyCasesDelivered', 'qtyBottlesDelivered', 'ratePerCase', 'unitRatePerBottle'].includes(field)) {
      const cases = Number(newRows[globalIndex].qtyCasesDelivered) || 0;
      const bottles = Number(newRows[globalIndex].qtyBottlesDelivered) || 0;
      const rateCase = parseFloat(newRows[globalIndex].ratePerCase as string) || 0;
      const rateBottle = parseFloat(newRows[globalIndex].unitRatePerBottle as string) || 0;
      
      const total = (cases * rateCase) + (bottles * rateBottle);
      newRows[globalIndex].totalAmount = total.toFixed(2);
    }

    setRows(newRows);
  };

  const addRow = () => setRows([...rows, { ...EMPTY_ROW }]);
  
  const removeRow = (index: number) => {
    const globalIndex = (currentPage - 1) * pageSize + index;
    if (rows.length === 1) return;
    const newRows = rows.filter((_, i) => i !== globalIndex);
    setRows(newRows);
    if (currentPage > Math.ceil(newRows.length / pageSize)) {
      setCurrentPage(Math.max(1, currentPage - 1));
    }
  };

  const handleSubmitOrders = () => {
    // Basic validation
    if (rows.some(r => !r.brandName || !r.brandNumber)) {
      toast({ title: "Validation Error", description: "Please fill in Brand Number and Name for all rows.", variant: "destructive" });
      return;
    }

    saveOrders(rows, {
      onSuccess: () => {
        toast({ title: "Success", description: "Orders saved successfully!", className: "bg-green-50 text-green-800" });
        setRows([{ ...EMPTY_ROW }]); // Reset
      },
      onError: () => toast({ title: "Error", description: "Failed to save orders.", variant: "destructive" })
    });
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      
      {/* File Upload Section */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-3">
           <h2 className="text-xl font-bold font-display mb-4 text-foreground">Import Invoice cum Delivery Data</h2>
        </div>
        
        <div className="md:col-span-2 bg-card rounded-2xl border border-border p-4 shadow-sm hover:shadow-md transition-all">
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/20 rounded-xl p-4 bg-secondary/10 hover:bg-secondary/30 transition-colors h-full">
            <div className="p-2 bg-primary/5 rounded-full mb-2">
              <UploadCloud className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">Upload Invoice</h3>
            <p className="text-xs text-muted-foreground text-center mb-3 max-w-sm">
              Upload your file here, or click to browse. Supported formats: .csv, .xls, .xlsx
            </p>
            
            <div className="flex items-center gap-3 w-full max-w-md">
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".csv,.xls,.xlsx,.pdf"
                onChange={handleFileChange}
                className="hidden" 
                id="file-upload"
              />
              <label 
                htmlFor="file-upload" 
                className="flex-1 cursor-pointer flex items-center justify-center gap-2 px-3 py-1.5 border border-border bg-background rounded-lg hover:bg-muted transition-colors text-xs font-medium"
              >
                <File className="w-3 h-3" />
                {selectedFile ? selectedFile.name : "Choose File..."}
              </label>
              
              <button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-primary/20 text-xs"
              >
                {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Upload"}
              </button>
            </div>
          </div>
        </div>

        <div className="md:col-span-1 bg-gradient-to-br from-primary/90 to-orange-600 rounded-2xl p-4 text-white shadow-lg shadow-primary/25 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3 backdrop-blur-sm">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-display font-bold mb-1">Templates</h3>
            <p className="text-white/80 text-xs leading-relaxed">
              Download a sample invoice template for reference, or get the Excel format to fill in your data.
            </p>
          </div>
          <div className="flex flex-col gap-2 mt-4">
            <a
              href="/api/template/download?format=pdf"
              download="Invoice_Template_Sample.pdf"
              data-testid="button-download-template-pdf"
              className="w-full py-2 bg-white text-primary font-bold rounded-xl hover:bg-white/90 active:scale-95 transition-all shadow-xl text-xs block text-center"
            >
              Sample Invoice (PDF)
            </a>
            <a
              href="/api/template/download?format=xlsx"
              download="Invoice_Template.xlsx"
              data-testid="button-download-template-xlsx"
              className="w-full py-2 bg-white/20 text-white font-bold rounded-xl hover:bg-white/30 active:scale-95 transition-all text-xs block text-center border border-white/30"
            >
              Excel Template (.xlsx)
            </a>
          </div>
        </div>
      </section>

      {/* Manual Entry Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold font-display text-foreground">Manual Order Entry</h2>
          <div className="flex gap-3">
             <button 
                onClick={addRow}
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-foreground rounded-lg font-medium hover:bg-secondary/80 border border-border transition-all"
              >
                <Plus className="w-4 h-4" /> Add Row
              </button>
             <button 
                onClick={handleSubmitOrders}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium shadow-lg shadow-primary/25 hover:bg-primary/90 hover:-translate-y-0.5 transition-all disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
                Save Orders
              </button>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1400px]">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="table-header w-12">#</th>
                  <th className="table-header w-32">Brand No</th>
                  <th className="table-header w-48">Brand Name</th>
                  <th className="table-header w-32">Type</th>
                  <th className="table-header w-24">Pack</th>
                  <th className="table-header w-36">Size (ml)</th>
                  <th className="table-header w-32 bg-blue-50/50">Cases Del.</th>
                  <th className="table-header w-32 bg-blue-50/50">Btls Del.</th>
                  <th className="table-header w-32 text-right">Rate/Case</th>
                  <th className="table-header w-32 text-right">Rate/Btl</th>
                  <th className="table-header w-36 text-right font-bold text-primary bg-primary/5">Total</th>
                  <th className="table-header w-32 text-right min-h-[48px] py-2">Breakage Btl Qty</th>
                  <th className="table-header w-48 min-h-[48px] py-2">Remarks</th>
                  <th className="table-header w-16"></th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx;
                  return (
                    <tr key={globalIdx} className="group hover:bg-muted/30 transition-colors">
                      <td className="table-cell text-muted-foreground text-center">{globalIdx + 1}</td>
                      
                      <td className="p-2 border-b border-border">
                        <input 
                          className="input-field" 
                          placeholder="Ex: 3066"
                          value={row.brandNumber}
                          onChange={(e) => handleRowChange(idx, "brandNumber", e.target.value)}
                        />
                      </td>
                      
                      <td className="p-2 border-b border-border">
                        <input 
                          className="input-field" 
                          placeholder="Brand Name"
                          value={row.brandName}
                          onChange={(e) => handleRowChange(idx, "brandName", e.target.value)}
                        />
                      </td>
                      
                      <td className="p-2 border-b border-border">
                        <select 
                          className="input-field"
                          value={row.productType}
                          onChange={(e) => handleRowChange(idx, "productType", e.target.value)}
                        >
                          {PRODUCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>

                      <td className="p-2 border-b border-border">
                        <select 
                          className="input-field"
                          value={row.packType}
                          onChange={(e) => handleRowChange(idx, "packType", e.target.value)}
                        >
                          {PACK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>

                      <td className="p-2 border-b border-border">
                        <select 
                          className="input-field"
                          value={row.packSize}
                          onChange={(e) => handleRowChange(idx, "packSize", e.target.value)}
                        >
                          {PACK_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>

                      <td className="p-2 border-b border-border bg-blue-50/10">
                        <input 
                          type="number" 
                          className="input-field text-right font-mono" 
                          value={row.qtyCasesDelivered ?? 0}
                          onChange={(e) => handleRowChange(idx, "qtyCasesDelivered", parseInt(e.target.value, 10) || 0)}
                        />
                      </td>

                      <td className="p-2 border-b border-border bg-blue-50/10">
                        <input 
                          type="number" 
                          className="input-field text-right font-mono" 
                          value={row.qtyBottlesDelivered ?? 0}
                          onChange={(e) => handleRowChange(idx, "qtyBottlesDelivered", parseInt(e.target.value, 10) || 0)}
                        />
                      </td>

                      <td className="p-2 border-b border-border">
                        <input 
                          type="number" 
                          className="input-field text-right font-mono" 
                          value={row.ratePerCase || ""}
                          onChange={(e) => handleRowChange(idx, "ratePerCase", e.target.value)}
                        />
                      </td>

                      <td className="p-2 border-b border-border">
                        <input 
                          type="number" 
                          className="input-field text-right font-mono" 
                          value={row.unitRatePerBottle || ""}
                          onChange={(e) => handleRowChange(idx, "unitRatePerBottle", e.target.value)}
                        />
                      </td>

                      <td className="table-cell text-right font-bold text-primary font-mono bg-primary/5">
                        ₹{row.totalAmount}
                      </td>

                      <td className="p-2 border-b border-border">
                        <input 
                          type="number" 
                          className="input-field text-right font-mono" 
                          value={row.breakageBottleQty ?? 0}
                          onChange={(e) => handleRowChange(idx, "breakageBottleQty", parseInt(e.target.value, 10) || 0)}
                        />
                      </td>

                      <td className="p-2 border-b border-border">
                        <input 
                          className="input-field" 
                          placeholder="Remarks"
                          value={row.remarks || ""}
                          onChange={(e) => handleRowChange(idx, "remarks", e.target.value)}
                        />
                      </td>

                      <td className="p-2 border-b border-border text-center">
                        <button 
                          onClick={() => removeRow(idx)}
                          disabled={rows.length === 1}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
            totalItems={rows.length}
          />
          
          <div className="p-4 bg-muted/20 border-t border-border">
             <button 
               onClick={addRow} 
               className="w-full py-3 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all font-medium flex items-center justify-center gap-2"
             >
               <Plus className="w-4 h-4" /> Add Another Row
             </button>
          </div>
        </div>
      </section>
    </div>
  );
}
