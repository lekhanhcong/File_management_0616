import { lazy } from 'react';

// Lazy loaded components for code splitting
// Note: Only include components that actually exist

export const LazyPerformanceDashboard = lazy(() => 
  import('@/components/PerformanceDashboard').then(module => ({ default: module.PerformanceDashboard }))
);

// Other components are commented out until they are created
// export const LazyFileTable = lazy(() => 
//   import('@/components/FileTable').then(module => ({ default: module.FileTable }))
// );

// export const LazyFileUploadModal = lazy(() => 
//   import('@/components/FileUploadModal').then(module => ({ default: module.FileUploadModal }))
// );

// export const LazyTeamManagement = lazy(() => 
//   import('@/components/TeamManagement').then(module => ({ default: module.TeamManagement }))
// );

// export const LazyAdvancedSearch = lazy(() => 
//   import('@/components/AdvancedSearch').then(module => ({ default: module.AdvancedSearch }))
// );

// export const LazyProjectManagement = lazy(() => 
//   import('@/components/ProjectManagement').then(module => ({ default: module.ProjectManagement }))
// );

// export const LazySettingsPanel = lazy(() => 
//   import('@/components/SettingsPanel').then(module => ({ default: module.SettingsPanel }))
// );

// Dynamic import utilities
export const dynamicImport = {
  // Chart libraries (heavy dependencies)
  charts: () => import('recharts').then(module => module),
  
  // PDF viewer (commented out - install react-pdf if needed)
  // pdfViewer: () => import('react-pdf').then(module => module),
  
  // Image editor (commented out - install konva if needed)
  // imageEditor: () => import('konva').then(module => module),
  
  // Markdown editor (commented out - install @uiw/react-md-editor if needed)
  // markdownEditor: () => import('@uiw/react-md-editor').then(module => module),
  
  // Date picker (commented out - install react-datepicker if needed)
  // datePicker: () => import('react-datepicker').then(module => module),
  
  // Advanced file operations (commented out - create this file if needed)
  // fileOperations: () => import('@/lib/advancedFileOperations').then(module => module),
  
  // Analytics (commented out - create this file if needed)
  // analytics: () => import('@/lib/analytics').then(module => module),
  
  // Export utilities (commented out - create this file if needed)
  // exportUtils: () => import('@/lib/exportUtils').then(module => module),
};

// Preload critical chunks
export const preloadCriticalChunks = () => {
  // Preload authentication components
  import('@/hooks/useAuth');
  
  // Preload WebSocket for real-time features
  import('@/hooks/useWebSocket');
  
  // Note: Only preload components that actually exist
};

// Bundle analysis utilities
export const bundleAnalysis = {
  // Track bundle size
  trackBundleSize: () => {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const entries = performance.getEntriesByType('navigation');
      if (entries.length > 0) {
        const navEntry = entries[0] as PerformanceNavigationTiming;
        return {
          transferSize: navEntry.transferSize,
          encodedBodySize: navEntry.encodedBodySize,
          decodedBodySize: navEntry.decodedBodySize,
        };
      }
    }
    return null;
  },
  
  // Monitor resource loading
  monitorResourceLoading: () => {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'resource') {
            const resourceEntry = entry as PerformanceResourceTiming;
            console.log(`Resource: ${resourceEntry.name}`, {
              transferSize: resourceEntry.transferSize,
              duration: resourceEntry.duration,
              initiatorType: resourceEntry.initiatorType,
            });
          }
        });
      });
      
      observer.observe({ entryTypes: ['resource'] });
      return observer;
    }
    return null;
  },
  
  // Analyze chunk loading performance
  analyzeChunkPerformance: () => {
    const chunks: Record<string, { loadTime: number; size: number; cached: boolean }> = {};
    
    if (typeof window !== 'undefined') {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      
      resources.forEach(resource => {
        if (resource.name.includes('.js') || resource.name.includes('.css')) {
          const chunkName = resource.name.split('/').pop() || 'unknown';
          chunks[chunkName] = {
            loadTime: resource.duration,
            size: resource.transferSize || 0,
            cached: resource.transferSize === 0,
          };
        }
      });
    }
    
    return chunks;
  },
};

// Tree shaking optimization helpers
export const treeShakingHelpers = {
  // Import only specific lodash functions
  importLodash: {
    debounce: () => import('lodash/debounce'),
    throttle: () => import('lodash/throttle'),
    chunk: () => import('lodash/chunk'),
    uniq: () => import('lodash/uniq'),
    sortBy: () => import('lodash/sortBy'),
    groupBy: () => import('lodash/groupBy'),
  },
  
  // Import specific date-fns functions
  importDateFns: {
    format: () => import('date-fns/format'),
    parseISO: () => import('date-fns/parseISO'),
    differenceInDays: () => import('date-fns/differenceInDays'),
    addDays: () => import('date-fns/addDays'),
    isAfter: () => import('date-fns/isAfter'),
    isBefore: () => import('date-fns/isBefore'),
  },
  
  // Import specific utility functions (commented out - create files if needed)
  importUtils: {
    fileUtils: () => import('@/lib/fileUtils').then(m => ({
      formatFileSize: m.formatFileSize,
      getFileIcon: m.getFileIcon,
      validateFileType: m.validateFileType,
    })),
    
    // formatUtils: () => import('@/lib/formatUtils').then(m => ({
    //   formatDate: m.formatDate,
    //   formatCurrency: m.formatCurrency,
    //   formatNumber: m.formatNumber,
    // })),
  },
};

// Service Worker for caching optimizations
export const serviceWorkerHelpers = {
  // Register service worker for caching
  registerServiceWorker: async () => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered:', registration);
        return registration;
      } catch (error) {
        console.error('Service Worker registration failed:', error);
        return null;
      }
    }
    return null;
  },
  
  // Update service worker
  updateServiceWorker: async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
      }
    }
  },
  
  // Clear cache
  clearCache: async (cacheName?: string) => {
    if ('caches' in window) {
      if (cacheName) {
        await caches.delete(cacheName);
      } else {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
    }
  },
};

// Module federation helpers (for micro-frontends)
export const moduleFederationHelpers = {
  // Dynamically load remote modules
  loadRemoteModule: async (remoteName: string, moduleName: string) => {
    try {
      // @ts-ignore - Module federation runtime
      const container = window[remoteName];
      if (!container) {
        throw new Error(`Remote ${remoteName} not found`);
      }
      
      await container.init(__webpack_share_scopes__.default);
      const factory = await container.get(moduleName);
      return factory();
    } catch (error) {
      console.error(`Failed to load remote module ${remoteName}/${moduleName}:`, error);
      return null;
    }
  },
  
  // Check if remote module is available
  isRemoteModuleAvailable: (remoteName: string) => {
    // @ts-ignore
    return typeof window !== 'undefined' && window[remoteName];
  },
};

// Bundle size monitoring
export const bundleSizeMonitor = {
  // Monitor first load JS size
  getFirstLoadJSSize: () => {
    if (typeof window === 'undefined') return 0;
    
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    let totalSize = 0;
    
    scripts.forEach(script => {
      const src = script.getAttribute('src');
      if (src && !src.includes('chunk')) {
        // Estimate size based on resource timing
        const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        const resource = resources.find(r => r.name.includes(src));
        if (resource) {
          totalSize += resource.transferSize || 0;
        }
      }
    });
    
    return totalSize;
  },
  
  // Monitor async chunk sizes
  getAsyncChunkSizes: () => {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const asyncChunks: Record<string, number> = {};
    
    resources.forEach(resource => {
      if (resource.name.includes('chunk') && resource.name.includes('.js')) {
        const chunkName = resource.name.split('/').pop() || 'unknown';
        asyncChunks[chunkName] = resource.transferSize || 0;
      }
    });
    
    return asyncChunks;
  },
  
  // Calculate total bundle size
  getTotalBundleSize: () => {
    const firstLoadSize = bundleSizeMonitor.getFirstLoadJSSize();
    const asyncChunkSizes = bundleSizeMonitor.getAsyncChunkSizes();
    const asyncTotalSize = Object.values(asyncChunkSizes).reduce((sum, size) => sum + size, 0);
    
    return {
      firstLoad: firstLoadSize,
      asyncChunks: asyncTotalSize,
      total: firstLoadSize + asyncTotalSize,
    };
  },
};

// Export default optimization utilities
export default {
  dynamicImport,
  preloadCriticalChunks,
  bundleAnalysis,
  treeShakingHelpers,
  serviceWorkerHelpers,
  moduleFederationHelpers,
  bundleSizeMonitor,
};