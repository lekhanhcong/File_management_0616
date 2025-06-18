interface CacheConfig {
  maxAge: number; // in milliseconds
  maxItems: number;
  staleWhileRevalidate: boolean;
  compression: boolean;
  encryption: boolean;
}

interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
  compressed?: boolean;
  encrypted?: boolean;
}

class CacheStrategy<T = any> {
  private cache: Map<string, CacheItem<T>>;
  private config: CacheConfig;
  private storageKey: string;
  private compressionWorker?: Worker;

  constructor(
    storageKey: string,
    config: Partial<CacheConfig> = {}
  ) {
    this.storageKey = storageKey;
    this.cache = new Map();
    this.config = {
      maxAge: 30 * 60 * 1000, // 30 minutes default
      maxItems: 1000,
      staleWhileRevalidate: true,
      compression: false,
      encryption: false,
      ...config,
    };

    this.loadFromStorage();
    this.setupCleanupInterval();
    this.setupCompressionWorker();
  }

  private setupCompressionWorker() {
    if (this.config.compression && 'Worker' in window) {
      this.compressionWorker = new Worker('/workers/compression.js');
    }
  }

  private async compress(data: T): Promise<string> {
    if (!this.config.compression) {
      return JSON.stringify(data);
    }

    if (this.compressionWorker) {
      return new Promise((resolve, reject) => {
        this.compressionWorker!.postMessage({ type: 'compress', data });
        this.compressionWorker!.onmessage = (e) => {
          if (e.data.error) {
            reject(new Error(e.data.error));
          } else {
            resolve(e.data.compressed);
          }
        };
      });
    }

    // Fallback compression using built-in APIs
    try {
      const jsonString = JSON.stringify(data);
      const stream = new CompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();
      
      writer.write(new TextEncoder().encode(jsonString));
      writer.close();
      
      const chunks: Uint8Array[] = [];
      let done = false;
      
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) chunks.push(value);
      }
      
      const compressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        compressed.set(chunk, offset);
        offset += chunk.length;
      }
      
      return btoa(String.fromCharCode(...compressed));
    } catch (error) {
      console.warn('Compression failed, using uncompressed data:', error);
      return JSON.stringify(data);
    }
  }

  private async decompress(compressed: string): Promise<T> {
    if (!this.config.compression) {
      return JSON.parse(compressed);
    }

    try {
      const binaryString = atob(compressed);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const stream = new DecompressionStream('gzip');
      const writer = stream.writable.getWriter();
      const reader = stream.readable.getReader();
      
      writer.write(bytes);
      writer.close();
      
      const chunks: Uint8Array[] = [];
      let done = false;
      
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) chunks.push(value);
      }
      
      const decompressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        decompressed.set(chunk, offset);
        offset += chunk.length;
      }
      
      const jsonString = new TextDecoder().decode(decompressed);
      return JSON.parse(jsonString);
    } catch (error) {
      console.warn('Decompression failed, trying as uncompressed:', error);
      return JSON.parse(compressed);
    }
  }

  private encrypt(data: string): string {
    if (!this.config.encryption) return data;
    
    // Simple XOR encryption for demo (use proper encryption in production)
    const key = 'fileflow-secret-key';
    let encrypted = '';
    for (let i = 0; i < data.length; i++) {
      encrypted += String.fromCharCode(
        data.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }
    return btoa(encrypted);
  }

  private decrypt(encrypted: string): string {
    if (!this.config.encryption) return encrypted;
    
    try {
      const data = atob(encrypted);
      const key = 'fileflow-secret-key';
      let decrypted = '';
      for (let i = 0; i < data.length; i++) {
        decrypted += String.fromCharCode(
          data.charCodeAt(i) ^ key.charCodeAt(i % key.length)
        );
      }
      return decrypted;
    } catch (error) {
      console.warn('Decryption failed:', error);
      return encrypted;
    }
  }

  private getStorageSize(data: any): number {
    return new Blob([JSON.stringify(data)]).size;
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const decrypted = this.decrypt(stored);
        const parsed = JSON.parse(decrypted);
        this.cache = new Map(parsed);
      }
    } catch (error) {
      console.warn('Failed to load cache from storage:', error);
      this.cache = new Map();
    }
  }

  private saveToStorage() {
    try {
      const serialized = JSON.stringify(Array.from(this.cache.entries()));
      const encrypted = this.encrypt(serialized);
      localStorage.setItem(this.storageKey, encrypted);
    } catch (error) {
      console.warn('Failed to save cache to storage:', error);
    }
  }

  private setupCleanupInterval() {
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // Cleanup every 5 minutes
  }

  private cleanup() {
    const now = Date.now();
    const itemsToRemove: string[] = [];

    // Remove expired items
    for (const [key, item] of this.cache.entries()) {
      if (item.expiresAt < now) {
        itemsToRemove.push(key);
      }
    }

    itemsToRemove.forEach(key => this.cache.delete(key));

    // Remove least recently used items if cache is too large
    if (this.cache.size > this.config.maxItems) {
      const sortedEntries = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);

      const itemsToDelete = sortedEntries.slice(0, this.cache.size - this.config.maxItems);
      itemsToDelete.forEach(([key]) => this.cache.delete(key));
    }

    this.saveToStorage();
  }

  async set(key: string, data: T, customMaxAge?: number): Promise<boolean> {
    try {
      const now = Date.now();
      const maxAge = customMaxAge || this.config.maxAge;
      const compressed = await this.compress(data);
      
      const item: CacheItem<T> = {
        data,
        timestamp: now,
        expiresAt: now + maxAge,
        accessCount: 0,
        lastAccessed: now,
        size: this.getStorageSize(data),
        compressed: this.config.compression,
        encrypted: this.config.encryption,
      };

      this.cache.set(key, item);
      this.saveToStorage();
      return true;
    } catch (error) {
      console.error('Failed to set cache item:', error);
      return false;
    }
  }

  async get(key: string, revalidateFn?: () => Promise<T>): Promise<T | null> {
    const item = this.cache.get(key);
    const now = Date.now();

    if (!item) {
      // Cache miss - try to revalidate if function provided
      if (revalidateFn) {
        try {
          const freshData = await revalidateFn();
          await this.set(key, freshData);
          return freshData;
        } catch (error) {
          console.warn('Revalidation failed:', error);
        }
      }
      return null;
    }

    // Update access stats
    item.accessCount++;
    item.lastAccessed = now;

    // Check if expired
    if (item.expiresAt < now) {
      if (this.config.staleWhileRevalidate && revalidateFn) {
        // Return stale data while revalidating in background
        revalidateFn()
          .then(freshData => this.set(key, freshData))
          .catch(error => console.warn('Background revalidation failed:', error));
        
        return item.data;
      } else {
        // Remove expired item
        this.cache.delete(key);
        this.saveToStorage();
        return null;
      }
    }

    return item.data;
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    
    const now = Date.now();
    if (item.expiresAt < now) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.saveToStorage();
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    localStorage.removeItem(this.storageKey);
  }

  keys(): string[] {
    const now = Date.now();
    const validKeys: string[] = [];
    
    for (const [key, item] of this.cache.entries()) {
      if (item.expiresAt >= now) {
        validKeys.push(key);
      }
    }
    
    return validKeys;
  }

  size(): number {
    return this.cache.size;
  }

  getStats() {
    const now = Date.now();
    let totalSize = 0;
    let expiredCount = 0;
    const accessCounts: number[] = [];

    for (const [, item] of this.cache.entries()) {
      totalSize += item.size;
      accessCounts.push(item.accessCount);
      
      if (item.expiresAt < now) {
        expiredCount++;
      }
    }

    return {
      totalItems: this.cache.size,
      totalSize,
      expiredItems: expiredCount,
      averageAccessCount: accessCounts.length > 0 
        ? accessCounts.reduce((sum, count) => sum + count, 0) / accessCounts.length 
        : 0,
      hitRatio: this.calculateHitRatio(),
      config: this.config,
    };
  }

  private hitRatio = 0;
  private requests = 0;
  private hits = 0;

  private calculateHitRatio(): number {
    return this.requests > 0 ? this.hits / this.requests : 0;
  }

  // Utility methods for specific cache strategies
  static createAPICache(baseURL: string) {
    return new CacheStrategy(`api-cache-${baseURL}`, {
      maxAge: 5 * 60 * 1000, // 5 minutes
      maxItems: 500,
      staleWhileRevalidate: true,
      compression: true,
    });
  }

  static createFileCache() {
    return new CacheStrategy('file-cache', {
      maxAge: 60 * 60 * 1000, // 1 hour
      maxItems: 100,
      staleWhileRevalidate: false,
      compression: true,
      encryption: true,
    });
  }

  static createUserPreferencesCache() {
    return new CacheStrategy('user-preferences', {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      maxItems: 50,
      staleWhileRevalidate: false,
      compression: false,
      encryption: true,
    });
  }

  static createSearchCache() {
    return new CacheStrategy('search-cache', {
      maxAge: 10 * 60 * 1000, // 10 minutes
      maxItems: 200,
      staleWhileRevalidate: true,
      compression: true,
    });
  }
}

// Memory-based cache for session data
class MemoryCache<T = any> {
  private cache: Map<string, { data: T; expiresAt: number }>;
  private maxSize: number;

  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  set(key: string, data: T, ttl = 5 * 60 * 1000): void {
    // Remove oldest item if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Global cache instances
export const apiCache = CacheStrategy.createAPICache('main');
export const fileCache = CacheStrategy.createFileCache();
export const userPreferencesCache = CacheStrategy.createUserPreferencesCache();
export const searchCache = CacheStrategy.createSearchCache();
export const memoryCache = new MemoryCache(200);

export { CacheStrategy, MemoryCache };