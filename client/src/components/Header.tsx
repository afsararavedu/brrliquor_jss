import { Search, Bell, User } from "lucide-react";
import { useLocation } from "wouter";

export function Header() {
  const [location] = useLocation();
  
  // Format the current path into a title
  const getTitle = () => {
    if (location === "/") return "Dashboard";
    const segment = location.split("/")[1];
    return segment.charAt(0).toUpperCase() + segment.slice(1).replace("-", " ");
  };

  return (
    <header className="h-20 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-40 flex items-center justify-between px-8 transition-all select-none">
      <div className="flex flex-col">
        <h2 className="text-2xl font-display font-bold text-foreground">{getTitle()}</h2>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Home</span>
          <span>/</span>
          <span className="text-primary font-medium">{getTitle()}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:block group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input 
            placeholder="Global search..." 
            className="pl-10 pr-4 py-2 rounded-full bg-secondary/50 border border-transparent focus:bg-background focus:border-primary/20 focus:ring-4 focus:ring-primary/5 outline-none transition-all w-64 text-sm font-medium"
          />
        </div>
        
        <button className="relative w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center hover:bg-secondary hover:text-primary transition-colors text-muted-foreground">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-background" />
        </button>
        
        <div className="flex items-center gap-3 pl-4 border-l border-border/50">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-foreground">Admin User</p>
            <p className="text-xs text-muted-foreground">Manager</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-300 border-2 border-white shadow-md flex items-center justify-center overflow-hidden">
             <User className="w-5 h-5 text-gray-500" />
          </div>
        </div>
      </div>
    </header>
  );
}
