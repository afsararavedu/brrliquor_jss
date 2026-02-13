import { Link } from "wouter";
import { ArrowRight, TrendingUp, Package, FileText, ShoppingCart } from "lucide-react";

export default function Home() {
  return (
    <div className="max-w-5xl mx-auto py-12 px-4 animate-in fade-in zoom-in duration-500 select-none">
      <div className="text-center mb-16 space-y-4">
        <h1 className="text-5xl font-display font-bold text-foreground">
          Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-600">BRR Liquor Portal</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Manage your daily sales, inventory, and orders with a professional, comprehensive dashboard.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Card 1: Sales */}
        <Link href="/sales">
          <div className="group relative bg-card rounded-3xl p-8 border border-border shadow-sm hover:shadow-2xl hover:border-primary/30 transition-all duration-300 cursor-pointer overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-8 -mt-8 group-hover:scale-110 transition-transform duration-500" />
            
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-white transition-colors duration-300 shadow-lg shadow-primary/10">
                <ShoppingCart className="w-7 h-7" />
              </div>
              
              <h3 className="text-2xl font-bold font-display mb-2">Daily Sales</h3>
              <p className="text-muted-foreground mb-6">
                Record and track daily sales figures, opening and closing balances.
              </p>
              
              <div className="flex items-center text-primary font-semibold gap-2 group-hover:translate-x-2 transition-transform">
                Go to Sales <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </Link>

        {/* Card 2: Inventory */}
        <Link href="/inventory">
          <div className="group relative bg-card rounded-3xl p-8 border border-border shadow-sm hover:shadow-2xl hover:border-blue-500/30 transition-all duration-300 cursor-pointer overflow-hidden select-none">
             <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-full -mr-8 -mt-8 group-hover:scale-110 transition-transform duration-500" />
            
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300 shadow-lg shadow-blue-500/10">
                <FileText className="w-7 h-7" />
              </div>
              
              <h3 className="text-2xl font-bold font-display mb-2">Orders & Uploads</h3>
              <p className="text-muted-foreground mb-6">
                Manual order entry forms and bulk file upload capabilities.
              </p>
              
              <div className="flex items-center text-blue-600 font-semibold gap-2 group-hover:translate-x-2 transition-transform">
                Manage Data <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </Link>

        {/* Card 3: Stock (Placeholder) */}
        <Link href="/stock">
          <div className="group relative bg-card rounded-3xl p-8 border border-border shadow-sm hover:shadow-2xl hover:border-green-500/30 transition-all duration-300 cursor-pointer overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-bl-full -mr-8 -mt-8 group-hover:scale-110 transition-transform duration-500" />
            
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 text-green-600 flex items-center justify-center mb-6 group-hover:bg-green-600 group-hover:text-white transition-colors duration-300 shadow-lg shadow-green-500/10">
                <Package className="w-7 h-7" />
              </div>
              
              <h3 className="text-2xl font-bold font-display mb-2">Stock Inventory</h3>
              <p className="text-muted-foreground mb-6">
                Monitor stock levels, indents, and inventory status in real-time.
              </p>
              
              <div className="flex items-center text-green-600 font-semibold gap-2 group-hover:translate-x-2 transition-transform">
                Check Stock <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </Link>
      </div>
      
      <div className="mt-16 bg-gradient-to-r from-primary/10 via-orange-100 to-primary/5 rounded-3xl p-12 text-center border border-primary/10">
        <h2 className="text-2xl font-display font-bold mb-4">Need help getting started?</h2>
        <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
          Check out our documentation or contact support for assistance with data imports and system configuration.
        </p>
        <button className="px-8 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all hover:-translate-y-1">
          View Documentation
        </button>
      </div>
    </div>
  );
}
