import { useState, useEffect, useCallback, useMemo } from 'react';
import { localStorageService, type StorageEvent, type StorageMetrics, type CacheSettings } from '@/services/LocalStorageService';
import { localStorageManager } from '@/lib/localStorage';

export interface UseLocalStorageManagerOptions {
  enableRealTimeUpdates?: boolean;
  updateInterval?: number;
  autoOptimize?: boolean;
  optimizeInterval?: number;
}

export interface LocalStorageState {
  isLoading: boolean;
  storageInfo: ReturnType<typeof localStorageService.getStorageInfo>;
  metrics: StorageMetrics;
  settings: CacheSettings;
  files: any[];
  lastUpdated: number;
  error: string | null;
  events: StorageEvent[];
}

export interface LocalStorageActions {
  // File operations
  uploadFile: (file: File) => Promise<{ success: boolean; fileId?: string; error?: string }>;
  deleteFile: (fileId: string) => boolean;
  exportFile: (fileId: string) => void;
  clearAllFiles: () => boolean;
  
  // Cache operations
  setCache: <T>(key: string, data: T, ttl?: number) => boolean;
  getCache: <T>(key: string) => T | null;
  deleteCache: (key: string) => boolean;
  clearCache: () => void;
  
  // Settings
  updateSettings: (settings: Partial<CacheSettings>) => void;
  
  // Optimization
  optimize: () => Promise<{ before: StorageMetrics; after: StorageMetrics; improvements: string[] }>;
  cleanup: () => void;
  
  // Backup/Restore
  createBackup: () => Promise<any>;
  restoreBackup: (backup: any) => Promise<{ success: boolean; error?: string }>;
  
  // Refresh data
  refresh: () => void;
  
  // Event management
  clearEvents: () => void;
}

const DEFAULT_OPTIONS: UseLocalStorageManagerOptions = {
  enableRealTimeUpdates: true,
  updateInterval: 5000, // 5 seconds
  autoOptimize: false,
  optimizeInterval: 30 * 60 * 1000, // 30 minutes
};

export const useLocalStorageManager = (options: UseLocalStorageManagerOptions = {}) => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const [state, setState] = useState<LocalStorageState>({
    isLoading: true,
    storageInfo: localStorageService.getStorageInfo(),
    metrics: localStorageService.getMetrics(),
    settings: localStorageService.getCacheSettings(),
    files: [],
    lastUpdated: Date.now(),
    error: null,
    events: [],
  });

  // Update state from services
  const updateState = useCallback(() => {
    try {
      setState(prev => ({
        ...prev,
        storageInfo: localStorageService.getStorageInfo(),
        metrics: localStorageService.getMetrics(),
        settings: localStorageService.getCacheSettings(),
        files: localStorageService.getAllFiles(),
        lastUpdated: Date.now(),
        error: null,
        isLoading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      }));
    }
  }, []);

  // Event handler for storage events
  const handleStorageEvent = useCallback((event: StorageEvent) => {
    setState(prev => ({
      ...prev,
      events: [event, ...prev.events.slice(0, 99)], // Keep last 100 events
    }));
    
    // Update state for certain events
    if (['cache-set', 'cache-delete', 'cleanup'].includes(event.type)) {
      updateState();
    }
  }, [updateState]);

  // Initialize and setup event listeners
  useEffect(() => {
    updateState();

    // Subscribe to storage events
    const eventTypes: StorageEvent['type'][] = [
      'cache-hit', 'cache-miss', 'cache-set', 'cache-delete', 'cleanup', 'quota-exceeded'
    ];

    for (const eventType of eventTypes) {
      localStorageService.addEventListener(eventType, handleStorageEvent);
    }

    return () => {
      for (const eventType of eventTypes) {
        localStorageService.removeEventListener(eventType, handleStorageEvent);
      }
    };
  }, [updateState, handleStorageEvent]);

  // Real-time updates
  useEffect(() => {
    if (!opts.enableRealTimeUpdates) return;

    const interval = setInterval(updateState, opts.updateInterval);
    return () => clearInterval(interval);
  }, [opts.enableRealTimeUpdates, opts.updateInterval, updateState]);

  // Auto-optimize
  useEffect(() => {
    if (!opts.autoOptimize) return;

    const interval = setInterval(async () => {
      try {
        await localStorageService.optimize();
        updateState();
      } catch (error) {
        console.error('Auto-optimization failed:', error);
      }
    }, opts.optimizeInterval);

    return () => clearInterval(interval);
  }, [opts.autoOptimize, opts.optimizeInterval, updateState]);

  // Actions
  const actions: LocalStorageActions = useMemo(() => ({
    // File operations
    uploadFile: async (file: File) => {
      setState(prev => ({ ...prev, isLoading: true }));
      try {
        const result = await localStorageService.storeFile(file);
        updateState();
        return result;
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Upload failed',
          isLoading: false,
        }));
        return { success: false, error: 'Upload failed' };
      }
    },

    deleteFile: (fileId: string) => {
      try {
        const result = localStorageService.deleteFile(fileId);
        updateState();
        return result;
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Delete failed',
        }));
        return false;
      }
    },

    exportFile: (fileId: string) => {
      try {
        localStorageService.exportFile(fileId);
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Export failed',
        }));
      }
    },

    clearAllFiles: () => {
      try {
        const result = localStorageManager.clearAllFiles();
        updateState();
        return result;
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Clear failed',
        }));
        return false;
      }
    },

    // Cache operations
    setCache: <T>(key: string, data: T, ttl?: number) => {
      try {
        const result = localStorageService.set(key, data, ttl);
        updateState();
        return result;
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Cache set failed',
        }));
        return false;
      }
    },

    getCache: <T>(key: string): T | null => {
      try {
        return localStorageService.get<T>(key);
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Cache get failed',
        }));
        return null;
      }
    },

    deleteCache: (key: string) => {
      try {
        const result = localStorageService.delete(key);
        updateState();
        return result;
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Cache delete failed',
        }));
        return false;
      }
    },

    clearCache: () => {
      try {
        localStorageService.clear();
        updateState();
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Cache clear failed',
        }));
      }
    },

    // Settings
    updateSettings: (settings: Partial<CacheSettings>) => {
      try {
        localStorageService.updateCacheSettings(settings);
        updateState();
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Settings update failed',
        }));
      }
    },

    // Optimization
    optimize: async () => {
      setState(prev => ({ ...prev, isLoading: true }));
      try {
        const result = await localStorageService.optimize();
        updateState();
        return result;
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Optimization failed',
          isLoading: false,
        }));
        throw error;
      }
    },

    cleanup: () => {
      try {
        // Manual cleanup is internal to the service
        updateState();
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Cleanup failed',
        }));
      }
    },

    // Backup/Restore
    createBackup: async () => {
      setState(prev => ({ ...prev, isLoading: true }));
      try {
        const backup = await localStorageService.createBackup();
        setState(prev => ({ ...prev, isLoading: false }));
        return backup;
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Backup creation failed',
          isLoading: false,
        }));
        throw error;
      }
    },

    restoreBackup: async (backup: any) => {
      setState(prev => ({ ...prev, isLoading: true }));
      try {
        const result = await localStorageService.restoreFromBackup(backup);
        updateState();
        return result;
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Backup restore failed',
          isLoading: false,
        }));
        return { success: false, error: 'Restore failed' };
      }
    },

    // Utility
    refresh: () => {
      updateState();
    },

    clearEvents: () => {
      setState(prev => ({ ...prev, events: [] }));
    },
  }), [updateState]);

  // Computed values
  const computed = useMemo(() => {
    const { storageInfo, metrics } = state;
    
    return {
      isNearQuota: storageInfo.total.usedPercentage > 80,
      isCriticalQuota: storageInfo.total.usedPercentage > 95,
      cacheEfficiency: metrics.hitRate,
      recommendOptimization: storageInfo.total.usedPercentage > 70 || metrics.entryCount > 500,
      storageHealth: {
        status: storageInfo.total.usedPercentage > 95 ? 'critical' 
               : storageInfo.total.usedPercentage > 80 ? 'warning' 
               : 'good',
        score: Math.max(0, 100 - storageInfo.total.usedPercentage),
        issues: [
          ...(storageInfo.total.usedPercentage > 90 ? ['High storage usage'] : []),
          ...(metrics.hitRate < 50 ? ['Low cache efficiency'] : []),
          ...(metrics.entryCount > 1000 ? ['Too many cache entries'] : []),
        ],
      },
    };
  }, [state.storageInfo, state.metrics]);

  return {
    // State
    ...state,
    
    // Actions
    ...actions,
    
    // Computed values
    ...computed,
    
    // Raw services for advanced usage
    service: localStorageService,
    manager: localStorageManager,
  };
};

// Utility hook for simple cache usage
export const useLocalStorageCache = <T>(key: string, defaultValue?: T, ttl?: number) => {
  const [value, setValue] = useState<T | null>(() => {
    return localStorageService.get<T>(key) ?? defaultValue ?? null;
  });

  const setCache = useCallback((newValue: T) => {
    localStorageService.set(key, newValue, ttl);
    setValue(newValue);
  }, [key, ttl]);

  const clearCache = useCallback(() => {
    localStorageService.delete(key);
    setValue(defaultValue ?? null);
  }, [key, defaultValue]);

  // Update value when cache changes
  useEffect(() => {
    const handleCacheEvent = (event: StorageEvent) => {
      if (event.type === 'cache-set' && event.details?.key === key) {
        setValue(localStorageService.get<T>(key));
      } else if (event.type === 'cache-delete' && event.details?.key === key) {
        setValue(defaultValue ?? null);
      }
    };

    localStorageService.addEventListener('cache-set', handleCacheEvent);
    localStorageService.addEventListener('cache-delete', handleCacheEvent);

    return () => {
      localStorageService.removeEventListener('cache-set', handleCacheEvent);
      localStorageService.removeEventListener('cache-delete', handleCacheEvent);
    };
  }, [key, defaultValue]);

  return {
    value,
    setValue: setCache,
    clearValue: clearCache,
    hasValue: value !== null && value !== undefined,
  };
};