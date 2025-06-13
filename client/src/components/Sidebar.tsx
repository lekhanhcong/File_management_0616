import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import FileUploadModal from "./FileUploadModal";
import { 
  Home, 
  Folder, 
  FileText, 
  Plus, 
  Users, 
  BarChart3, 
  Shield, 
  Settings, 
  HelpCircle,
  FolderPlus,
  UserPlus,
  Table
} from "lucide-react";

export default function Sidebar() {
  const { user } = useAuth();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const createActions = [
    {
      icon: FileText,
      label: "New document",
      color: "text-blue-600 bg-blue-100",
      action: () => console.log("Create document"),
    },
    {
      icon: Table,
      label: "New spreadsheet", 
      color: "text-green-600 bg-green-100",
      action: () => console.log("Create spreadsheet"),
    },
    {
      icon: FolderPlus,
      label: "New project",
      color: "text-purple-600 bg-purple-100", 
      action: () => console.log("Create project"),
    },
    {
      icon: UserPlus,
      label: "New team",
      color: "text-orange-600 bg-orange-100",
      action: () => console.log("Create team"),
    },
  ];

  const navigationItems = [
    { icon: Home, label: "Home", active: true },
    { icon: Folder, label: "All projects" },
    { icon: FileText, label: "Project files" },
  ];

  const toolItems = [
    { icon: FileText, label: "Templates" },
    { icon: BarChart3, label: "Dashboards" },
    { icon: BarChart3, label: "Analysis" },
    { icon: Shield, label: "Manage access" },
  ];

  return (
    <>
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* User Profile */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <img
                src={user?.profileImageUrl || "https://images.unsplash.com/photo-1494790108755-2616b612b647?w=40&h=40&fit=crop&crop=face"}
                alt="User Avatar"
                className="w-10 h-10 rounded-full object-cover"
              />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user?.email}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {/* Main Navigation */}
          <div className="space-y-1">
            {navigationItems.map((item) => (
              <Button
                key={item.label}
                variant={item.active ? "default" : "ghost"}
                className="w-full justify-start"
                size="sm"
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.label}
              </Button>
            ))}
          </div>

          {/* Create New Section */}
          <div className="pt-6">
            <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Create New
            </p>
            <div className="space-y-1">
              {createActions.map((action) => (
                <Button
                  key={action.label}
                  variant="ghost"
                  className="w-full justify-between group"
                  size="sm"
                  onClick={action.action}
                >
                  <div className="flex items-center">
                    <div className={`w-5 h-5 mr-3 rounded flex items-center justify-center ${action.color}`}>
                      <action.icon className="w-3 h-3" />
                    </div>
                    {action.label}
                  </div>
                  <Plus className="w-4 h-4 text-gray-400 group-hover:text-primary" />
                </Button>
              ))}
            </div>
          </div>

          {/* Tools Section */}
          <div className="pt-6">
            <div className="space-y-1">
              {toolItems.map((item) => (
                <Button
                  key={item.label}
                  variant="ghost"
                  className="w-full justify-start"
                  size="sm"
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Upload Button */}
          <div className="pt-6">
            <Button
              onClick={() => setIsUploadModalOpen(true)}
              className="w-full"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Upload Files
            </Button>
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-gray-200">
          <div className="space-y-1">
            <Button variant="ghost" className="w-full justify-start" size="sm">
              <HelpCircle className="w-5 h-5 mr-3" />
              Support
            </Button>
            <Button variant="ghost" className="w-full justify-start" size="sm">
              <Settings className="w-5 h-5 mr-3" />
              Settings
            </Button>
          </div>
          
          <Separator className="my-3" />
          
          <div className="flex items-center justify-between px-3">
            <div className="text-xs text-gray-500">Untitled UI</div>
            <Badge variant="secondary" className="text-xs">
              v4.0
            </Badge>
          </div>
        </div>
      </aside>

      <FileUploadModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
      />
    </>
  );
}
