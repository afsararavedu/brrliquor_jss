import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Sales from "@/pages/Sales";
import Stock from "@/pages/Stock";
import OtherData from "@/pages/OtherData";
import Reports from "@/pages/Reports";
import AuthPage from "@/pages/AuthPage";
import ResetPassword from "@/pages/ResetPassword";

function ProtectedRoute({ component: Component, path, role }: { component: React.ComponentType, path: string, role?: string }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <Redirect to="/auth" />;
  if (user.mustResetPassword && path !== "/reset-password") return <Redirect to="/reset-password" />;
  if (role && user.role !== role) return <Redirect to="/" />;
  
  return <Component />;
}

function Router() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen bg-background font-sans">
      {user && !user.mustResetPassword && <Sidebar />}
      <div className={`flex-1 ${user && !user.mustResetPassword ? 'md:pl-64' : ''} flex flex-col min-h-screen transition-all`}>
        {user && !user.mustResetPassword && <Header />}
        <main className="flex-1 p-8 overflow-x-hidden">
          <div className="max-w-[1600px] mx-auto">
            <Switch>
              <Route path="/auth" component={AuthPage} />
              <Route path="/reset-password" component={ResetPassword} />
              
              <Route path="/">
                <ProtectedRoute component={Home} path="/" role="admin" />
              </Route>
              <Route path="/sales">
                <ProtectedRoute component={Sales} path="/sales" />
              </Route>
              <Route path="/stock">
                <ProtectedRoute component={Stock} path="/stock" role="admin" />
              </Route>
              <Route path="/other-data">
                <ProtectedRoute component={OtherData} path="/other-data" role="admin" />
              </Route>
              <Route path="/reports">
                <ProtectedRoute component={Reports} path="/reports" role="admin" />
              </Route>
              
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
