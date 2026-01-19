import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Sales from "@/pages/Sales";
import Stock from "@/pages/Stock";
import OtherData from "@/pages/OtherData";
import Reports from "@/pages/Reports";

function Router() {
  return (
    <div className="flex min-h-screen bg-background font-sans">
      <Sidebar />
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen transition-all">
        <Header />
        <main className="flex-1 p-8 overflow-x-hidden">
          <div className="max-w-[1600px] mx-auto">
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/sales" component={Sales} />
              <Route path="/stock" component={Stock} />
              <Route path="/other-data" component={OtherData} />
              <Route path="/reports" component={Reports} />
              <Route path="/credits" component={() => <div className="p-12 text-center text-muted-foreground">Credits Module Coming Soon</div>} />
              <Route path="/calendar" component={() => <div className="p-12 text-center text-muted-foreground">Calendar Module Coming Soon</div>} />
              
              <Route component={NotFound} />
            </Switch>
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
