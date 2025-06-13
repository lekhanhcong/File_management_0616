import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getFileIcon } from "@/lib/fileUtils";
import type { FileWithDetails } from "@shared/schema";

export default function RecentFiles() {
  const { data: recentFiles, isLoading } = useQuery({
    queryKey: ['/api/files/recent'],
    retry: false,
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recently modified</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    );
  }

  if (!recentFiles || recentFiles.length === 0) {
    return (
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recently modified</h2>
        </div>
        <div className="text-center py-8 text-gray-500">
          <p>No recent files found</p>
          <p className="text-sm">Upload some files to see them here</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Recently modified</h2>
        <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700">
          View all
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {recentFiles.slice(0, 6).map((file: FileWithDetails) => (
          <Card key={file.id} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <div className={`file-icon ${getFileIcon(file.mimeType)} flex-shrink-0`}>
                  {getFileIcon(file.mimeType) === 'file-icon-pdf' && '📄'}
                  {getFileIcon(file.mimeType) === 'file-icon-doc' && '📝'}
                  {getFileIcon(file.mimeType) === 'file-icon-xls' && '📊'}
                  {getFileIcon(file.mimeType) === 'file-icon-img' && '🖼️'}
                  {getFileIcon(file.mimeType) === 'file-icon-default' && '📄'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-900 truncate">
                    {file.name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatFileSize(file.size)} • {file.mimeType.split('/')[1]?.toUpperCase()}
                  </p>
                  <div className="flex items-center mt-2">
                    {file.uploader?.profileImageUrl && (
                      <img
                        src={file.uploader.profileImageUrl}
                        alt={`${file.uploader.firstName} ${file.uploader.lastName}`}
                        className="w-4 h-4 rounded-full object-cover"
                      />
                    )}
                    <span className="text-xs text-gray-500 ml-2">
                      {file.uploader?.firstName} {file.uploader?.lastName}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
