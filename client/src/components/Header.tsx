import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import FileUploadModal from "./FileUploadModal";
import { Search, Upload, Bell, MoreHorizontal } from "lucide-react";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function Header() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { isConnected } = useWebSocket();

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-gray-900">Project files</h1>
            {isConnected && (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1"></div>
                Live
              </Badge>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Manage and organize your team's documents
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          
          {/* Upload Button */}
          <Button onClick={() => setIsUploadModalOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
          
          {/* Notifications */}
          <Button variant="ghost" size="sm">
            <Bell className="h-4 w-4" />
          </Button>
          
          {/* More Actions */}
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <FileUploadModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
      />
    </>
  );
}
