import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import QuickActions from "@/components/QuickActions";
import RecentFiles from "@/components/RecentFiles";
import FileTable from "@/components/FileTable";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function Home() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const { isConnected } = useWebSocket();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <div className="flex-1 overflow-auto p-6">
          <QuickActions />
          <RecentFiles />
          
          <section>
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">All files</h2>
                    <div className="flex items-center mt-1">
                      <p className="text-sm text-gray-600">Manage and organize your team's documents</p>
                      {isConnected && (
                        <div className="ml-2 flex items-center">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span className="ml-1 text-xs text-green-600">Live</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                    <i className="fas fa-ellipsis-h"></i>
                  </button>
                </div>
              </div>
              
              <FileTable />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
