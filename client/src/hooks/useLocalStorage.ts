import { useState, useEffect, useCallback } from 'react';
import { localStorageManager } from '@/lib/localStorage';

export interface StoredFile {
  id: string;
  name: string;
  size: number;
  type: string;
  data: string;
  uploadDate: string;
  lastModified: number;
}

export function useLocalStorage() {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [storageInfo, setStorageInfo] = useState(localStorageManager.getStorageInfo());
  const [isLoading, setIsLoading] = useState(false);

  const refreshFiles = useCallback(() => {
    const allFiles = localStorageManager.getAllFiles();
    setFiles(allFiles);
    setStorageInfo(localStorageManager.getStorageInfo());
  }, []);

  const uploadFile = useCallback(async (file: File, onProgress?: (progress: number) => void) => {
    setIsLoading(true);
    try {
      if (onProgress) onProgress(25);
      
      const result = await localStorageManager.storeFile(file);
      
      if (onProgress) onProgress(75);
      
      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }
      
      if (onProgress) onProgress(100);
      
      refreshFiles();
      return { success: true, fileId: result.fileId };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    } finally {
      setIsLoading(false);
    }
  }, [refreshFiles]);

  const deleteFile = useCallback((fileId: string) => {
    const success = localStorageManager.deleteFile(fileId);
    if (success) {
      refreshFiles();
    }
    return success;
  }, [refreshFiles]);

  const downloadFile = useCallback((fileId: string) => {
    localStorageManager.exportFile(fileId);
  }, []);

  const getFileBlob = useCallback((fileId: string) => {
    return localStorageManager.getFileAsBlob(fileId);
  }, []);

  const clearAllFiles = useCallback(() => {
    const success = localStorageManager.clearAllFiles();
    if (success) {
      refreshFiles();
    }
    return success;
  }, [refreshFiles]);

  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  return {
    files,
    storageInfo,
    isLoading,
    uploadFile,
    deleteFile,
    downloadFile,
    getFileBlob,
    clearAllFiles,
    refreshFiles
  };
}