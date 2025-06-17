interface StoredFile {
  id: string;
  name: string;
  size: number;
  type: string;
  data: string; // base64 encoded
  uploadDate: string;
  lastModified: number;
}

interface LocalStorageData {
  files: StoredFile[];
  settings: {
    maxFileSize: number;
    allowedTypes: string[];
    compressionQuality: number;
  };
}

const STORAGE_KEY = 'fileFlowMaster';
const MAX_STORAGE_SIZE = 50 * 1024 * 1024; // 50MB limit for localStorage

export class LocalStorageManager {
  private static instance: LocalStorageManager;
  
  static getInstance(): LocalStorageManager {
    if (!LocalStorageManager.instance) {
      LocalStorageManager.instance = new LocalStorageManager();
    }
    return LocalStorageManager.instance;
  }

  private getStorageData(): LocalStorageData {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        return this.getDefaultData();
      }
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return this.getDefaultData();
    }
  }

  private getDefaultData(): LocalStorageData {
    return {
      files: [],
      settings: {
        maxFileSize: 5 * 1024 * 1024, // 5MB
        allowedTypes: [
          'image/jpeg', 'image/png', 'image/gif', 'image/webp',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain', 'text/csv'
        ],
        compressionQuality: 0.8
      }
    };
  }

  private saveStorageData(data: LocalStorageData): boolean {
    try {
      const serialized = JSON.stringify(data);
      if (serialized.length > MAX_STORAGE_SIZE) {
        throw new Error('Storage quota exceeded');
      }
      localStorage.setItem(STORAGE_KEY, serialized);
      return true;
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      return false;
    }
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // Remove data:mime;base64, prefix
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private validateFile(file: File): { isValid: boolean; error?: string } {
    const data = this.getStorageData();
    const { maxFileSize, allowedTypes } = data.settings;

    if (file.size > maxFileSize) {
      return {
        isValid: false,
        error: `File size exceeds ${Math.round(maxFileSize / 1024 / 1024)}MB limit`
      };
    }

    if (!allowedTypes.includes(file.type)) {
      return {
        isValid: false,
        error: `File type ${file.type} is not supported`
      };
    }

    return { isValid: true };
  }

  async storeFile(file: File): Promise<{ success: boolean; fileId?: string; error?: string }> {
    try {
      const validation = this.validateFile(file);
      if (!validation.isValid) {
        return { success: false, error: validation.error };
      }

      const data = this.getStorageData();
      const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const base64Data = await this.fileToBase64(file);

      const storedFile: StoredFile = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        data: base64Data,
        uploadDate: new Date().toISOString(),
        lastModified: file.lastModified
      };

      data.files.push(storedFile);
      
      const saved = this.saveStorageData(data);
      if (!saved) {
        return { success: false, error: 'Failed to save file to storage' };
      }

      return { success: true, fileId };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  getFile(fileId: string): StoredFile | null {
    const data = this.getStorageData();
    return data.files.find(file => file.id === fileId) || null;
  }

  getAllFiles(): StoredFile[] {
    const data = this.getStorageData();
    return data.files;
  }

  deleteFile(fileId: string): boolean {
    try {
      const data = this.getStorageData();
      data.files = data.files.filter(file => file.id !== fileId);
      return this.saveStorageData(data);
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  clearAllFiles(): boolean {
    try {
      const data = this.getStorageData();
      data.files = [];
      return this.saveStorageData(data);
    } catch (error) {
      console.error('Error clearing files:', error);
      return false;
    }
  }

  getStorageInfo(): { 
    used: number; 
    available: number; 
    fileCount: number;
    usedPercentage: number;
  } {
    try {
      const data = this.getStorageData();
      const used = JSON.stringify(data).length;
      const available = MAX_STORAGE_SIZE - used;
      const usedPercentage = (used / MAX_STORAGE_SIZE) * 100;
      
      return {
        used,
        available,
        fileCount: data.files.length,
        usedPercentage
      };
    } catch (error) {
      return { used: 0, available: MAX_STORAGE_SIZE, fileCount: 0, usedPercentage: 0 };
    }
  }

  getFileAsBlob(fileId: string): Blob | null {
    const file = this.getFile(fileId);
    if (!file) return null;

    try {
      const byteCharacters = atob(file.data);
      const byteNumbers = new Array(byteCharacters.length);
      
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      return new Blob([byteArray], { type: file.type });
    } catch (error) {
      console.error('Error converting file to blob:', error);
      return null;
    }
  }

  exportFile(fileId: string): void {
    const file = this.getFile(fileId);
    if (!file) return;

    const blob = this.getFileAsBlob(fileId);
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  updateSettings(newSettings: Partial<LocalStorageData['settings']>): boolean {
    try {
      const data = this.getStorageData();
      data.settings = { ...data.settings, ...newSettings };
      return this.saveStorageData(data);
    } catch (error) {
      console.error('Error updating settings:', error);
      return false;
    }
  }

  getSettings(): LocalStorageData['settings'] {
    return this.getStorageData().settings;
  }
}

export const localStorageManager = LocalStorageManager.getInstance();