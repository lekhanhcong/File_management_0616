import { useState, useEffect, useCallback } from 'react';
import { performanceMonitor } from '@/lib/performanceMonitor';

interface PerformanceData {
  webVitals: {
    FCP: number;
    LCP: number;
    FID: number;
    CLS: number;
    TTI: number;
  };
  customMetrics: any;
  performanceScore: number;
  isLoading: boolean;
}

export function usePerformance() {
  const [performanceData, setPerformanceData] = useState<PerformanceData>({
    webVitals: {
      FCP: 0,
      LCP: 0,
      FID: 0,
      CLS: 0,
      TTI: 0,
    },
    customMetrics: {},
    performanceScore: 0,
    isLoading: true,
  });

  const updatePerformanceData = useCallback(async () => {
    try {
      const report = await performanceMonitor.generateReport();
      setPerformanceData({
        webVitals: report.webVitals,
        customMetrics: report.customMetrics,
        performanceScore: report.summary.performanceScore,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to get performance data:', error);
      setPerformanceData(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    // Initial load
    updatePerformanceData();

    // Update every 10 seconds
    const interval = setInterval(updatePerformanceData, 10000);

    return () => clearInterval(interval);
  }, [updatePerformanceData]);

  const measureFeature = useCallback((featureName: string) => {
    return {
      start: () => performanceMonitor.markFeatureStart(featureName),
      end: () => performanceMonitor.markFeatureEnd(featureName),
    };
  }, []);

  const measureApiCall = useCallback((endpoint: string, duration: number, status: number) => {
    performanceMonitor.measureApiCall(endpoint, duration, status);
  }, []);

  const measureFileOperation = useCallback((operation: string, duration: number, fileSize?: number) => {
    performanceMonitor.measureFileOperation(operation, duration, fileSize);
  }, []);

  const getPerformanceReport = useCallback(async () => {
    return await performanceMonitor.generateReport();
  }, []);

  return {
    performanceData,
    measureFeature,
    measureApiCall,
    measureFileOperation,
    getPerformanceReport,
    refresh: updatePerformanceData,
  };
}

export function useFeaturePerformance(featureName: string) {
  const [isTracking, setIsTracking] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);

  const startTracking = useCallback(() => {
    if (isTracking) return;
    
    setIsTracking(true);
    setDuration(null);
    performanceMonitor.markFeatureStart(featureName);
  }, [featureName, isTracking]);

  const endTracking = useCallback(() => {
    if (!isTracking) return;
    
    performanceMonitor.markFeatureEnd(featureName);
    setIsTracking(false);
    
    // Get the measured duration
    try {
      const measure = performance.getEntriesByName(featureName, 'measure')[0];
      if (measure) {
        setDuration(measure.duration);
      }
    } catch (error) {
      console.warn(`Failed to get duration for ${featureName}:`, error);
    }
  }, [featureName, isTracking]);

  return {
    isTracking,
    duration,
    startTracking,
    endTracking,
  };
}

export function useApiPerformance() {
  const [apiMetrics, setApiMetrics] = useState<{
    [endpoint: string]: {
      averageTime: number;
      calls: number;
      errors: number;
      successRate: number;
    };
  }>({});

  const trackApiCall = useCallback(
    async <T>(
      endpoint: string,
      apiCall: () => Promise<T>
    ): Promise<T> => {
      const startTime = performance.now();
      let status = 200;
      
      try {
        const result = await apiCall();
        return result;
      } catch (error) {
        status = 500;
        throw error;
      } finally {
        const duration = performance.now() - startTime;
        performanceMonitor.measureApiCall(endpoint, duration, status);
        
        // Update local metrics
        setApiMetrics(prev => {
          const current = prev[endpoint] || {
            averageTime: 0,
            calls: 0,
            errors: 0,
            successRate: 100,
          };
          
          const newCalls = current.calls + 1;
          const newErrors = current.errors + (status >= 400 ? 1 : 0);
          const newAverageTime = (current.averageTime * current.calls + duration) / newCalls;
          const newSuccessRate = ((newCalls - newErrors) / newCalls) * 100;
          
          return {
            ...prev,
            [endpoint]: {
              averageTime: newAverageTime,
              calls: newCalls,
              errors: newErrors,
              successRate: newSuccessRate,
            },
          };
        });
      }
    },
    []
  );

  return {
    apiMetrics,
    trackApiCall,
  };
}

export function useMemoryMonitoring() {
  const [memoryUsage, setMemoryUsage] = useState({
    usedJSHeapSize: 0,
    totalJSHeapSize: 0,
    jsHeapSizeLimit: 0,
    usagePercentage: 0,
  });

  const updateMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const usagePercentage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
      
      setMemoryUsage({
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        usagePercentage,
      });
      
      performanceMonitor.measureMemoryUsage();
    }
  }, []);

  useEffect(() => {
    updateMemoryUsage();
    
    // Update every 5 seconds
    const interval = setInterval(updateMemoryUsage, 5000);
    
    return () => clearInterval(interval);
  }, [updateMemoryUsage]);

  return {
    memoryUsage,
    updateMemoryUsage,
    formatBytes: (bytes: number) => {
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      if (bytes === 0) return '0 Bytes';
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    },
  };
}

export function useRenderPerformance(componentName: string) {
  const [renderCount, setRenderCount] = useState(0);
  const [lastRenderTime, setLastRenderTime] = useState<number | null>(null);

  useEffect(() => {
    const startTime = performance.now();
    
    setRenderCount(prev => prev + 1);
    
    // Measure render time on next tick
    setTimeout(() => {
      const renderTime = performance.now() - startTime;
      setLastRenderTime(renderTime);
      
      performanceMonitor.measureUserInteraction(`${componentName}_render`, renderTime);
    }, 0);
  });

  return {
    renderCount,
    lastRenderTime,
  };
}