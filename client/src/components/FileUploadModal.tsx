import { useState, useCallback, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { X, Upload as UploadIcon, File, CheckCircle, AlertCircle, HardDrive, Info } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { localStorageManager } from "@/lib/localStorage";
import { formatFileSize } from "@/lib/fileUtils";

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UploadFile {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'validating';
  error?: string;
  localStorageId?: string;
  uploadMode: 'server' | 'local';
}

export default function FileUploadModal({ isOpen, onClose }: FileUploadModalProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadMode, setUploadMode] = useState<'server' | 'local'>('server');
  const [storageInfo, setStorageInfo] = useState(localStorageManager.getStorageInfo());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isOpen) {
      setStorageInfo(localStorageManager.getStorageInfo());
    }
  }, [isOpen]);

  const updateStorageInfo = useCallback(() => {
    setStorageInfo(localStorageManager.getStorageInfo());
  }, []);

  const serverUploadMutation = useMutation({
    mutationFn: async (uploadFile: UploadFile) => {
      const formData = new FormData();
      formData.append('file', uploadFile.file);
      formData.append('projectId', 'default');

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: (data, uploadFile) => {
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: 'success', progress: 100 }
          : f
      ));
      queryClient.invalidateQueries({ queryKey: ['files'] });
      queryClient.invalidateQueries({ queryKey: ['recent-files'] });
    },
    onError: (error: Error, uploadFile) => {
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: 'error', error: error.message }
          : f
      ));
    }
  });

  const localUploadMutation = useMutation({
    mutationFn: async (uploadFile: UploadFile) => {
      // Simulate progress for local storage
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id ? { ...f, progress: 25 } : f
      ));
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id ? { ...f, progress: 50 } : f
      ));
      
      const result = await localStorageManager.storeFile(uploadFile.file);
      
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id ? { ...f, progress: 75 } : f
      ));
      
      if (!result.success) {
        throw new Error(result.error || 'Local storage failed');
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return { fileId: result.fileId };
    },
    onSuccess: (data, uploadFile) => {
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: 'success', progress: 100, localStorageId: data.fileId }
          : f
      ));
      updateStorageInfo();
    },
    onError: (error: Error, uploadFile) => {
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: 'error', error: error.message, progress: 0 }
          : f
      ));
    }
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const validateAndAddFiles = useCallback(async (newFiles: File[]) => {
    const uploadFiles: UploadFile[] = [];
    
    for (const file of newFiles) {
      const fileId = Math.random().toString(36).substr(2, 9);
      const uploadFile: UploadFile = {
        file,
        id: fileId,
        progress: 0,
        status: 'validating',
        uploadMode
      };
      
      uploadFiles.push(uploadFile);
    }
    
    setFiles(prev => [...prev, ...uploadFiles]);
    
    // Validate files
    for (const uploadFile of uploadFiles) {
      try {
        if (uploadMode === 'local') {
          const settings = localStorageManager.getSettings();
          const isValidSize = uploadFile.file.size <= settings.maxFileSize;
          const isValidType = settings.allowedTypes.includes(uploadFile.file.type);
          
          if (!isValidSize || !isValidType) {
            const error = !isValidSize 
              ? `File size exceeds ${Math.round(settings.maxFileSize / 1024 / 1024)}MB limit`
              : `File type ${uploadFile.file.type} is not supported`;
            
            setFiles(prev => prev.map(f => 
              f.id === uploadFile.id 
                ? { ...f, status: 'error', error }
                : f
            ));
            continue;
          }
        }
        
        setFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, status: 'pending' }
            : f
        ));
      } catch (error) {
        setFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, status: 'error', error: 'Validation failed' }
            : f
        ));
      }
    }
  }, [uploadMode]);

  const addFiles = (newFiles: File[]) => {
    validateAndAddFiles(newFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const startUpload = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    
    for (const file of pendingFiles) {
      setFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, status: 'uploading' } : f
      ));
      
      if (file.uploadMode === 'local') {
        localUploadMutation.mutate(file);
      } else {
        serverUploadMutation.mutate(file);
      }
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };


  const handleClose = () => {
    setFiles([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Upload Files</DialogTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant={uploadMode === 'server' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setUploadMode('server')}
              >
                Server
              </Button>
              <Button
                variant={uploadMode === 'local' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setUploadMode('local')}
              >
                Local
              </Button>
            </div>
          </div>
          {uploadMode === 'local' && (
            <Alert>
              <HardDrive className="h-4 w-4" />
              <AlertDescription>
                Files will be stored locally in your browser. 
                Storage used: {Math.round(storageInfo.usedPercentage)}% 
                ({formatFileSize(storageInfo.used)} / {formatFileSize(50 * 1024 * 1024)})
              </AlertDescription>
            </Alert>
          )}
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto">
          {/* Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <UploadIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-2">
              Drop files here or click to browse
            </p>
            <p className="text-sm text-gray-500 mb-4">
              {uploadMode === 'local' 
                ? `Supports: PDF, DOC, DOCX, XLS, XLSX, TXT, JPG, PNG, GIF (max ${Math.round(localStorageManager.getSettings().maxFileSize / 1024 / 1024)}MB)`
                : 'Supports: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, JPG, PNG, GIF (max 50MB)'
              }
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="mx-auto"
            >
              Choose Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif"
            />
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-4">Files to Upload</h3>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {files.map((uploadFile) => (
                  <div key={uploadFile.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                    <File className="h-8 w-8 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {uploadFile.file.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(uploadFile.file.size)}
                      </p>
                      {uploadFile.status === 'validating' && (
                        <div className="flex items-center mt-1">
                          <Info className="h-3 w-3 text-blue-500 mr-1" />
                          <span className="text-xs text-blue-600">Validating...</span>
                        </div>
                      )}
                      {uploadFile.status === 'uploading' && (
                        <Progress value={uploadFile.progress} className="mt-2" />
                      )}
                      {uploadFile.status === 'error' && (
                        <p className="text-sm text-red-500 mt-1">{uploadFile.error}</p>
                      )}
                      {uploadFile.status === 'success' && uploadFile.uploadMode === 'local' && (
                        <div className="flex items-center mt-1">
                          <Badge variant="secondary" className="text-xs">
                            Stored Locally
                          </Badge>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {uploadFile.status === 'success' && (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                      {uploadFile.status === 'error' && (
                        <AlertCircle className="h-5 w-5 text-red-500" />
                      )}
                      {uploadFile.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(uploadFile.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            {files.some(f => f.status === 'success') ? 'Done' : 'Cancel'}
          </Button>
          {files.some(f => f.status === 'pending') && (
            <Button 
              onClick={startUpload}
              disabled={serverUploadMutation.isPending || localUploadMutation.isPending}
            >
              {(serverUploadMutation.isPending || localUploadMutation.isPending) 
                ? `Uploading to ${uploadMode}...` 
                : `Upload to ${uploadMode === 'local' ? 'Local Storage' : 'Server'}`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}