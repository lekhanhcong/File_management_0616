import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Home from "@/pages/Home";
import Landing from "@/pages/Landing";
import NotFound from "@/pages/not-found";
import ErrorBoundary from "@/components/ErrorBoundary";
import { NotificationProvider } from "@/components/NotificationProvider";
import { PageLoading } from "@/components/LoadingSpinner";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoading message="Initializing application..." />;
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Home} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <NotificationProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </NotificationProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
