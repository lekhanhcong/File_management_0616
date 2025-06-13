import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import FileUploadModal from "./FileUploadModal";
import { FileText, Table, FolderPlus, Users, Plus } from "lucide-react";

const quickActions = [
  {
    icon: FileText,
    title: "New document",
    description: "Create a new document",
    color: "bg-blue-100 text-blue-600",
    action: () => console.log("Create document"),
  },
  {
    icon: Table,
    title: "New spreadsheet", 
    description: "Create a new spreadsheet",
    color: "bg-green-100 text-green-600",
    action: () => console.log("Create spreadsheet"),
  },
  {
    icon: FolderPlus,
    title: "New project",
    description: "Start a new project",
    color: "bg-purple-100 text-purple-600",
    action: () => console.log("Create project"),
  },
  {
    icon: Users,
    title: "New team",
    description: "Create a new team",
    color: "bg-orange-100 text-orange-600",
    action: () => console.log("Create team"),
  },
];

export default function QuickActions() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  return (
    <>
      <section className="mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Card 
              key={action.title}
              className="hover:shadow-md transition-shadow cursor-pointer group"
              onClick={action.action}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${action.color}`}>
                    <action.icon className="h-6 w-6" />
                  </div>
                  <Plus className="h-4 w-4 text-gray-400 group-hover:text-primary transition-colors" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">
                  {action.title}
                </h3>
                <p className="text-sm text-gray-600">
                  {action.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <FileUploadModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)} 
      />
    </>
  );
}
