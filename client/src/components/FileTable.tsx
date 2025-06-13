import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getFileIcon } from "@/lib/fileUtils";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Search, Filter, MoreHorizontal, Download, Edit, Share, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import type { FileWithDetails } from "@shared/schema";

const FILE_TYPES = [
  { value: "all", label: "View all" },
  { value: "application/pdf", label: "PDFs" },
  { value: "application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document", label: "Documents" },
  { value: "application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", label: "Spreadsheets" },
  { value: "image/png,image/jpeg,image/gif,image/webp", label: "Images" },
];

export default function FileTable() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/files', { page: currentPage, search: searchQuery, mimeTypes: selectedType !== "all" ? selectedType : undefined }],
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      await apiRequest('DELETE', `/api/files/${fileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      toast({
        title: "Success",
        description: "File deleted successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: "Failed to delete file",
        variant: "destructive",
      });
    },
  });

  const downloadFile = async (file: FileWithDetails) => {
    try {
      const response = await fetch(`/api/files/${file.id}/download`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = file.originalName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "File download started",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  };

  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  const toggleAllFiles = () => {
    if (!data?.files) return;
    
    if (selectedFiles.length === data.files.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(data.files.map(file => file.id));
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (error && isUnauthorizedError(error)) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {FILE_TYPES.map((type) => (
            <Button
              key={type.value}
              variant={selectedType === type.value ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedType(type.value)}
            >
              {type.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-80"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2 text-gray-600">Loading files...</span>
          </div>
        ) : data?.files?.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-2">No files found</div>
            <p className="text-sm text-gray-400">
              {searchQuery ? "Try adjusting your search criteria" : "Upload your first file to get started"}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      checked={selectedFiles.length === data?.files?.length}
                      onCheckedChange={toggleAllFiles}
                    />
                    <span>File name</span>
                  </div>
                </TableHead>
                <TableHead>Uploaded by</TableHead>
                <TableHead>Last modified</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.files?.map((file: FileWithDetails) => (
                <TableRow key={file.id} className="hover:bg-gray-50">
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        checked={selectedFiles.includes(file.id)}
                        onCheckedChange={() => toggleFileSelection(file.id)}
                      />
                      <div className={`file-icon ${getFileIcon(file.mimeType)}`}>
                        {getFileIcon(file.mimeType) === 'file-icon-pdf' && '📄'}
                        {getFileIcon(file.mimeType) === 'file-icon-doc' && '📝'}
                        {getFileIcon(file.mimeType) === 'file-icon-xls' && '📊'}
                        {getFileIcon(file.mimeType) === 'file-icon-img' && '🖼️'}
                        {getFileIcon(file.mimeType) === 'file-icon-default' && '📄'}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {file.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {file.mimeType.split('/')[1]?.toUpperCase() || 'FILE'}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {file.uploader?.profileImageUrl && (
                        <img
                          src={file.uploader.profileImageUrl}
                          alt={`${file.uploader.firstName} ${file.uploader.lastName}`}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {file.uploader?.firstName} {file.uploader?.lastName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {file.uploader?.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-900">
                    {formatDate(file.updatedAt)}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {formatFileSize(file.size)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {file.isOfflineAvailable && (
                        <Badge variant="secondary" className="text-xs">
                          <div className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1"></div>
                          Offline
                        </Badge>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => downloadFile(file)}>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Share className="h-4 w-4 mr-2" />
                            Share
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => deleteMutation.mutate(file.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing{' '}
              <span className="font-medium">
                {((currentPage - 1) * 20) + 1}
              </span>{' '}
              to{' '}
              <span className="font-medium">
                {Math.min(currentPage * 20, data.total)}
              </span>{' '}
              of{' '}
              <span className="font-medium">{data.total}</span> files
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm font-medium">
                Page {currentPage} of {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(data.totalPages, prev + 1))}
                disabled={currentPage === data.totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
