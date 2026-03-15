import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth";
import OwnerDashboard from "@/pages/owner/dashboard";
import PropertyDetails from "@/pages/owner/property-details";
import TenantDashboard from "@/pages/tenant/dashboard";
import AdminDashboard from "@/pages/admin/dashboard";
import PgOwnerDashboard from "@/pages/pg-owner/dashboard";
import PrivacyPolicy from "@/pages/privacy-policy";
import { PageSkeleton } from "@/components/layout";
import type { User } from "@shared/schema";

function ProtectedRoute({ 
  component: Component, 
  allowedRoles 
}: { 
  component: React.ComponentType; 
  allowedRoles?: string[];
}) {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    retry: false,
    staleTime: Infinity,
  });
  const [, setLocation] = useLocation();

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === "admin") {
      return <Redirect to="/admin/dashboard" />;
    } else if (user.role === "owner") {
      return <Redirect to="/owner/dashboard" />;
    } else if (user.role === "pg_owner") {
      return <Redirect to="/pg-owner/dashboard" />;
    } else {
      return <Redirect to="/tenant/dashboard" />;
    }
  }

  return <Component />;
}

function AuthRoute() {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    retry: false,
    staleTime: Infinity,
  });

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (user) {
    if (user.role === "admin") {
      return <Redirect to="/admin/dashboard" />;
    } else if (user.role === "owner") {
      return <Redirect to="/owner/dashboard" />;
    } else if (user.role === "pg_owner") {
      return <Redirect to="/pg-owner/dashboard" />;
    } else {
      return <Redirect to="/tenant/dashboard" />;
    }
  }

  return <AuthPage />;
}

function Router() {
  return (
    <Switch>
      <Route path="/">
        <Redirect to="/auth" />
      </Route>
      <Route path="/auth" component={AuthRoute} />
      <Route path="/owner/dashboard">
        <ProtectedRoute component={OwnerDashboard} allowedRoles={["owner"]} />
      </Route>
      <Route path="/owner/property/:id">
        <ProtectedRoute component={PropertyDetails} allowedRoles={["owner"]} />
      </Route>
      <Route path="/tenant/dashboard">
        <ProtectedRoute component={TenantDashboard} allowedRoles={["tenant"]} />
      </Route>
      <Route path="/admin/dashboard">
        <ProtectedRoute component={AdminDashboard} allowedRoles={["admin"]} />
      </Route>
      <Route path="/pg-owner/dashboard">
        <ProtectedRoute component={PgOwnerDashboard} allowedRoles={["pg_owner"]} />
      </Route>
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route component={NotFound} />
    </Switch>
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
