import { localStorageManager } from '@/lib/localStorage';

// Extended interfaces for enhanced functionality
export interface CacheEntry<T = any> {
  key: string;
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  compressed: boolean;
  size: number;
}

export interface CacheSettings {
  maxEntries: number;
  defaultTTL: number;
  compressionThreshold: number;
  enableCleanup: boolean;
  cleanupInterval: number;
}

export interface StorageMetrics {
  totalSize: number;
  cacheSize: number;
  fileSize: number;
  entryCount: number;
  hitRate: number;
  compressionRatio: number;
  lastCleanup: number;
}

export interface BackupData {
  version: string;
  timestamp: number;
  files: any[];
  cache: CacheEntry[];
  settings: any;
  metrics: StorageMetrics;
}

export interface StorageEvent {
  type: 'cache-hit' | 'cache-miss' | 'cache-set' | 'cache-delete' | 'cleanup' | 'quota-exceeded';
  timestamp: number;
  details?: any;
}

// Advanced Local Storage Management Service
export class LocalStorageService {
  private static instance: LocalStorageService;
  private cache: Map<string, CacheEntry> = new Map();
  private metrics: StorageMetrics;
  private settings: CacheSettings;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private eventListeners: Map<string, ((event: StorageEvent) => void)[]> = new Map();

  private constructor() {
    this.settings = this.getDefaultCacheSettings();
    this.metrics = this.initializeMetrics();
    this.loadCache();
    this.startCleanupTimer();
  }

  static getInstance(): LocalStorageService {
    if (!LocalStorageService.instance) {
      LocalStorageService.instance = new LocalStorageService();
    }
    return LocalStorageService.instance;
  }

  private getDefaultCacheSettings(): CacheSettings {
    return {
      maxEntries: 1000,
      defaultTTL: 24 * 60 * 60 * 1000, // 24 hours
      compressionThreshold: 10 * 1024, // 10KB
      enableCleanup: true,
      cleanupInterval: 30 * 60 * 1000, // 30 minutes
    };
  }

  private initializeMetrics(): StorageMetrics {
    const saved = localStorage.getItem('ffm:metrics');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (error) {
        console.warn('Failed to load metrics, using defaults');
      }
    }

    return {
      totalSize: 0,
      cacheSize: 0,
      fileSize: 0,
      entryCount: 0,
      hitRate: 0,
      compressionRatio: 0,
      lastCleanup: Date.now(),
    };
  }

  private saveMetrics(): void {
    try {
      localStorage.setItem('ffm:metrics', JSON.stringify(this.metrics));
    } catch (error) {
      console.error('Failed to save metrics:', error);
    }
  }

  private loadCache(): void {
    try {
      const cacheData = localStorage.getItem('ffm:cache');
      if (cacheData) {
        const entries: CacheEntry[] = JSON.parse(cacheData);
        const now = Date.now();
        
        for (const entry of entries) {
          if (now - entry.timestamp < entry.ttl) {
            if (entry.compressed) {
              entry.data = this.decompressData(entry.data);
            }
            this.cache.set(entry.key, entry);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load cache:', error);
      this.cache.clear();
    }
  }

  private saveCache(): void {
    try {
      const entries = Array.from(this.cache.values());
      localStorage.setItem('ffm:cache', JSON.stringify(entries));
    } catch (error) {
      console.error('Failed to save cache:', error);
      this.handleQuotaExceeded('cache-save-failed');
    }
  }

  private compressData(data: any): string {
    // Simple compression using JSON + base64
    // In production, consider using a proper compression library
    try {
      const jsonString = JSON.stringify(data);
      return btoa(jsonString);
    } catch (error) {
      console.warn('Compression failed, storing uncompressed');
      return data;
    }
  }

  private decompressData(compressedData: string): any {
    try {
      const jsonString = atob(compressedData);
      return JSON.parse(jsonString);
    } catch (error) {
      console.warn('Decompression failed, returning as-is');
      return compressedData;
    }
  }

  private startCleanupTimer(): void {
    if (!this.settings.enableCleanup) return;

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.settings.cleanupInterval);
  }

  private cleanup(): void {
    const now = Date.now();
    let removedCount = 0;

    // Remove expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    // If cache is still too large, remove oldest entries
    if (this.cache.size > this.settings.maxEntries) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, this.cache.size - this.settings.maxEntries);
      for (const [key] of toRemove) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    this.metrics.lastCleanup = now;
    this.updateMetrics();
    this.saveCache();
    this.saveMetrics();

    this.emitEvent({
      type: 'cleanup',
      timestamp: now,
      details: { removedCount }
    });
  }

  private updateMetrics(): void {
    let cacheSize = 0;
    for (const entry of this.cache.values()) {
      cacheSize += entry.size;
    }

    const storageInfo = localStorageManager.getStorageInfo();
    
    this.metrics = {
      ...this.metrics,
      cacheSize,
      fileSize: storageInfo.used,
      entryCount: this.cache.size,
      totalSize: cacheSize + storageInfo.used,
    };
  }

  private handleQuotaExceeded(context: string): void {
    console.warn(`Quota exceeded in ${context}, performing emergency cleanup`);
    
    // Emergency cleanup - remove half of cache entries
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = entries.slice(0, Math.floor(entries.length / 2));
    for (const [key] of toRemove) {
      this.cache.delete(key);
    }

    this.saveCache();
    this.emitEvent({
      type: 'quota-exceeded',
      timestamp: Date.now(),
      details: { context, removedEntries: toRemove.length }
    });
  }

  private emitEvent(event: StorageEvent): void {
    const listeners = this.eventListeners.get(event.type) || [];
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Event listener error:', error);
      }
    }
  }

  // Public API Methods

  // Cache Management
  set<T>(key: string, data: T, ttl?: number): boolean {
    try {
      const now = Date.now();
      const entryTTL = ttl || this.settings.defaultTTL;
      const serializedData = JSON.stringify(data);
      const shouldCompress = serializedData.length > this.settings.compressionThreshold;
      
      const entry: CacheEntry<T> = {
        key,
        data: shouldCompress ? this.compressData(data) : data,
        timestamp: now,
        ttl: entryTTL,
        compressed: shouldCompress,
        size: serializedData.length,
      };

      this.cache.set(key, entry);
      this.updateMetrics();
      this.saveCache();

      this.emitEvent({
        type: 'cache-set',
        timestamp: now,
        details: { key, size: entry.size, compressed: shouldCompress }
      });

      return true;
    } catch (error) {
      console.error('Failed to set cache entry:', error);
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        this.handleQuotaExceeded('cache-set');
      }
      return false;
    }
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.emitEvent({
        type: 'cache-miss',
        timestamp: Date.now(),
        details: { key }
      });
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.emitEvent({
        type: 'cache-miss',
        timestamp: now,
        details: { key, reason: 'expired' }
      });
      return null;
    }

    this.emitEvent({
      type: 'cache-hit',
      timestamp: now,
      details: { key }
    });

    return entry.compressed ? this.decompressData(entry.data) : entry.data;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.updateMetrics();
      this.saveCache();
      this.emitEvent({
        type: 'cache-delete',
        timestamp: Date.now(),
        details: { key }
      });
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.updateMetrics();
    this.saveCache();
    localStorage.removeItem('ffm:cache');
  }

  // Advanced Cache Operations
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  keys(): string[] {
    const now = Date.now();
    const validKeys: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp <= entry.ttl) {
        validKeys.push(key);
      } else {
        this.cache.delete(key);
      }
    }
    
    return validKeys;
  }

  size(): number {
    this.cleanup(); // Remove expired entries first
    return this.cache.size;
  }

  // File Operations (proxy to localStorageManager)
  async storeFile(file: File): Promise<{ success: boolean; fileId?: string; error?: string }> {
    const result = await localStorageManager.storeFile(file);
    this.updateMetrics();
    return result;
  }

  getFile(fileId: string): any {
    return localStorageManager.getFile(fileId);
  }

  getAllFiles(): any[] {
    return localStorageManager.getAllFiles();
  }

  deleteFile(fileId: string): boolean {
    const result = localStorageManager.deleteFile(fileId);
    this.updateMetrics();
    return result;
  }

  exportFile(fileId: string): void {
    localStorageManager.exportFile(fileId);
  }

  // Storage Information
  getStorageInfo(): {
    files: ReturnType<typeof localStorageManager.getStorageInfo>;
    cache: {
      size: number;
      entryCount: number;
      hitRate: number;
      compressionRatio: number;
    };
    total: {
      used: number;
      available: number;
      usedPercentage: number;
    };
  } {
    const fileInfo = localStorageManager.getStorageInfo();
    this.updateMetrics();
    
    const totalUsed = fileInfo.used + this.metrics.cacheSize;
    const totalAvailable = 50 * 1024 * 1024; // 50MB total
    
    return {
      files: fileInfo,
      cache: {
        size: this.metrics.cacheSize,
        entryCount: this.cache.size,
        hitRate: this.metrics.hitRate,
        compressionRatio: this.metrics.compressionRatio,
      },
      total: {
        used: totalUsed,
        available: totalAvailable - totalUsed,
        usedPercentage: (totalUsed / totalAvailable) * 100,
      }
    };
  }

  // Settings Management
  updateCacheSettings(newSettings: Partial<CacheSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    localStorage.setItem('ffm:cache-settings', JSON.stringify(this.settings));
    
    // Restart cleanup timer if interval changed
    if (newSettings.cleanupInterval || newSettings.enableCleanup !== undefined) {
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
      }
      this.startCleanupTimer();
    }
  }

  getCacheSettings(): CacheSettings {
    return { ...this.settings };
  }

  // Backup and Restore
  async createBackup(): Promise<BackupData> {
    const allFiles = this.getAllFiles();
    const cacheEntries = Array.from(this.cache.values());
    
    return {
      version: '1.0.0',
      timestamp: Date.now(),
      files: allFiles,
      cache: cacheEntries,
      settings: {
        localStorage: localStorageManager.getSettings(),
        cache: this.settings,
      },
      metrics: this.metrics,
    };
  }

  async restoreFromBackup(backup: BackupData): Promise<{ success: boolean; error?: string }> {
    try {
      // Clear existing data
      this.clear();
      localStorageManager.clearAllFiles();
      
      // Restore cache
      for (const entry of backup.cache) {
        this.cache.set(entry.key, entry);
      }
      
      // Restore files would need to be implemented in localStorageManager
      // For now, we'll skip file restoration as it requires base64 data
      
      // Restore settings
      if (backup.settings.localStorage) {
        localStorageManager.updateSettings(backup.settings.localStorage);
      }
      if (backup.settings.cache) {
        this.updateCacheSettings(backup.settings.cache);
      }
      
      this.saveCache();
      this.updateMetrics();
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Event Handling
  addEventListener(eventType: StorageEvent['type'], listener: (event: StorageEvent) => void): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(listener);
  }

  removeEventListener(eventType: StorageEvent['type'], listener: (event: StorageEvent) => void): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // Utility Methods
  optimize(): Promise<{ 
    before: StorageMetrics; 
    after: StorageMetrics; 
    improvements: string[] 
  }> {
    return new Promise((resolve) => {
      const before = { ...this.metrics };
      const improvements: string[] = [];
      
      // Perform optimization
      this.cleanup();
      improvements.push('Cleaned up expired cache entries');
      
      // Compress large uncompressed entries
      let compressedCount = 0;
      for (const [key, entry] of this.cache.entries()) {
        if (!entry.compressed && entry.size > this.settings.compressionThreshold) {
          entry.data = this.compressData(entry.data);
          entry.compressed = true;
          compressedCount++;
        }
      }
      
      if (compressedCount > 0) {
        improvements.push(`Compressed ${compressedCount} cache entries`);
      }
      
      this.updateMetrics();
      this.saveCache();
      
      const after = { ...this.metrics };
      
      resolve({ before, after, improvements });
    });
  }

  getMetrics(): StorageMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  // Cleanup
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.eventListeners.clear();
  }
}

// Export singleton instance
export const localStorageService = LocalStorageService.getInstance();

// Helper hooks for React components
export const useLocalStorage = () => {
  return {
    service: localStorageService,
    storageInfo: localStorageService.getStorageInfo(),
    metrics: localStorageService.getMetrics(),
    settings: localStorageService.getCacheSettings(),
  };
};