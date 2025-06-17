import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  HardDrive, 
  Download, 
  Trash2, 
  File, 
  Image, 
  FileText,
  RefreshCw,
  AlertTriangle
} from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { formatFileSize, getFileIcon, isImageFile } from "@/lib/fileUtils";

export default function LocalFileManager() {
  const { 
    files, 
    storageInfo, 
    isLoading, 
    deleteFile, 
    downloadFile, 
    clearAllFiles, 
    refreshFiles 
  } = useLocalStorage();
  
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const getFileTypeIcon = (mimeType: string) => {
    if (isImageFile(mimeType)) {
      return <Image className="h-4 w-4" />;
    }
    if (mimeType === 'application/pdf') {
      return <FileText className="h-4 w-4 text-red-500" />;
    }
    return <File className="h-4 w-4" />;
  };

  const handleDownload = (fileId: string) => {
    downloadFile(fileId);
  };

  const handleDelete = (fileId: string) => {
    if (window.confirm('Are you sure you want to delete this file?')) {
      deleteFile(fileId);
    }
  };

  const handleClearAll = () => {
    if (showConfirmClear) {
      clearAllFiles();
      setShowConfirmClear(false);
    } else {
      setShowConfirmClear(true);
      setTimeout(() => setShowConfirmClear(false), 5000);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <HardDrive className="h-5 w-5" />
            <span>Local Storage</span>
          </CardTitle>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshFiles}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            {files.length > 0 && (
              <Button
                variant={showConfirmClear ? "destructive" : "outline"}
                size="sm"
                onClick={handleClearAll}
              >
                {showConfirmClear ? (
                  <>
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    Confirm Clear
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear All
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
        
        {/* Storage Info */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Storage Used</span>
            <span>{formatFileSize(storageInfo.used)} / {formatFileSize(50 * 1024 * 1024)}</span>
          </div>
          <Progress value={storageInfo.usedPercentage} className="h-2" />
          <div className="flex justify-between text-xs text-gray-500">
            <span>{storageInfo.fileCount} files</span>
            <span>{Math.round(storageInfo.usedPercentage)}% used</span>
          </div>
        </div>

        {storageInfo.usedPercentage > 80 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Storage is nearly full. Consider deleting some files or clearing all files.
            </AlertDescription>
          </Alert>
        )}
      </CardHeader>

      <CardContent>
        {files.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <HardDrive className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No files stored locally</p>
            <p className="text-sm">Upload files with "Local" mode to see them here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {files.map((file) => (
              <div key={file.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                <div className="flex-shrink-0">
                  {getFileTypeIcon(file.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.name}
                  </p>
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span>{formatFileSize(file.size)}</span>
                    <span>{new Date(file.uploadDate).toLocaleDateString()}</span>
                    <Badge variant="secondary" className="text-xs">
                      Local
                    </Badge>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(file.id)}
                    title="Download file"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(file.id)}
                    title="Delete file"
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}