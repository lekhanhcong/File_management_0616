import { Switch, Route } from "wouter";
import { Suspense, useEffect } from "react";
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
// import { preloadCriticalChunks, serviceWorkerHelpers } from "@/lib/bundleOptimization";
// import { performanceMonitor } from "@/lib/performanceMonitor";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoading message="Initializing application..." />;
  }

  return (
    <Suspense fallback={<PageLoading message="Loading application..." />}>
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
    </Suspense>
  );
}

function App() {
  useEffect(() => {
    // Initialize performance monitoring
    // performanceMonitor.startPeriodicReporting();
    
    // Preload critical chunks
    // preloadCriticalChunks();
    
    // Register service worker
    // serviceWorkerHelpers.registerServiceWorker();
    
    // Track app initialization performance
    // performanceMonitor.markFeatureStart('app_initialization');
    
    console.log('App initialized');
    
    // return () => {
    //   performanceMonitor.markFeatureEnd('app_initialization');
    // };
  }, []);

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
