interface PerformanceMetrics {
  navigationStart: number;
  loadEventEnd: number;
  domContentLoaded: number;
  firstPaint: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  firstInputDelay: number;
  cumulativeLayoutShift: number;
  timeToInteractive: number;
}

interface CustomMetric {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    navigationStart: 0,
    loadEventEnd: 0,
    domContentLoaded: 0,
    firstPaint: 0,
    firstContentfulPaint: 0,
    largestContentfulPaint: 0,
    firstInputDelay: 0,
    cumulativeLayoutShift: 0,
    timeToInteractive: 0,
  };

  private customMetrics: CustomMetric[] = [];
  private observers: PerformanceObserver[] = [];
  private isInitialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.isInitialized || typeof window === 'undefined') return;

    this.metrics.navigationStart = performance.timeOrigin;
    this.setupPerformanceObservers();
    this.setupEventListeners();
    this.measureTimeToInteractive();
    this.isInitialized = true;
  }

  private setupPerformanceObservers() {
    // Core Web Vitals Observer
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as PerformanceEntry;
        this.metrics.largestContentfulPaint = lastEntry.startTime;
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(lcpObserver);

      // First Input Delay
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          this.metrics.firstInputDelay = entry.processingStart - entry.startTime;
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
      this.observers.push(fidObserver);

      // Cumulative Layout Shift
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            this.metrics.cumulativeLayoutShift += entry.value;
          }
        });
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(clsObserver);

      // Paint Timing
      const paintObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name === 'first-paint') {
            this.metrics.firstPaint = entry.startTime;
          } else if (entry.name === 'first-contentful-paint') {
            this.metrics.firstContentfulPaint = entry.startTime;
          }
        });
      });
      paintObserver.observe({ entryTypes: ['paint'] });
      this.observers.push(paintObserver);

      // Navigation Timing
      const navigationObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          this.metrics.domContentLoaded = entry.domContentLoadedEventEnd - entry.navigationStart;
          this.metrics.loadEventEnd = entry.loadEventEnd - entry.navigationStart;
        });
      });
      navigationObserver.observe({ entryTypes: ['navigation'] });
      this.observers.push(navigationObserver);
    }
  }

  private setupEventListeners() {
    // DOM Content Loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.metrics.domContentLoaded = performance.now();
      });
    } else {
      this.metrics.domContentLoaded = performance.now();
    }

    // Load Event
    if (document.readyState !== 'complete') {
      window.addEventListener('load', () => {
        this.metrics.loadEventEnd = performance.now();
      });
    } else {
      this.metrics.loadEventEnd = performance.now();
    }
  }

  private measureTimeToInteractive() {
    // Simplified TTI measurement
    const checkTTI = () => {
      if (document.readyState === 'complete') {
        // Wait for main thread to be quiet for 5 seconds
        setTimeout(() => {
          this.metrics.timeToInteractive = performance.now();
        }, 5000);
      } else {
        setTimeout(checkTTI, 100);
      }
    };
    checkTTI();
  }

  // Public API
  public markFeatureStart(featureName: string) {
    performance.mark(`${featureName}-start`);
  }

  public markFeatureEnd(featureName: string) {
    performance.mark(`${featureName}-end`);
    try {
      performance.measure(featureName, `${featureName}-start`, `${featureName}-end`);
      const measure = performance.getEntriesByName(featureName, 'measure')[0];
      this.addCustomMetric(`feature_${featureName}`, measure.duration, {
        type: 'feature',
        feature: featureName,
      });
    } catch (error) {
      console.warn(`Failed to measure ${featureName}:`, error);
    }
  }

  public measureUserInteraction(action: string, duration: number) {
    this.addCustomMetric(`user_interaction_${action}`, duration, {
      type: 'interaction',
      action,
    });
  }

  public measureApiCall(endpoint: string, duration: number, status: number) {
    this.addCustomMetric(`api_call`, duration, {
      type: 'api',
      endpoint,
      status: status.toString(),
    });
  }

  public measureFileOperation(operation: string, duration: number, fileSize?: number) {
    this.addCustomMetric(`file_operation_${operation}`, duration, {
      type: 'file',
      operation,
      fileSize: fileSize?.toString(),
    });
  }

  public measureMemoryUsage() {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.addCustomMetric('memory_used_heap', memory.usedJSHeapSize, {
        type: 'memory',
        metric: 'used_heap',
      });
      this.addCustomMetric('memory_total_heap', memory.totalJSHeapSize, {
        type: 'memory',
        metric: 'total_heap',
      });
      this.addCustomMetric('memory_heap_limit', memory.jsHeapSizeLimit, {
        type: 'memory',
        metric: 'heap_limit',
      });
    }
  }

  private addCustomMetric(name: string, value: number, tags?: Record<string, string>) {
    this.customMetrics.push({
      name,
      value,
      timestamp: Date.now(),
      tags,
    });

    // Keep only last 1000 metrics
    if (this.customMetrics.length > 1000) {
      this.customMetrics = this.customMetrics.slice(-1000);
    }
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public getCustomMetrics(): CustomMetric[] {
    return [...this.customMetrics];
  }

  public getWebVitals() {
    return {
      FCP: this.metrics.firstContentfulPaint,
      LCP: this.metrics.largestContentfulPaint,
      FID: this.metrics.firstInputDelay,
      CLS: this.metrics.cumulativeLayoutShift,
      TTI: this.metrics.timeToInteractive,
    };
  }

  public async generateReport() {
    const webVitals = this.getWebVitals();
    const customMetrics = this.getCustomMetrics();
    
    // Group custom metrics by type
    const groupedMetrics = customMetrics.reduce((acc, metric) => {
      const type = metric.tags?.type || 'unknown';
      if (!acc[type]) acc[type] = [];
      acc[type].push(metric);
      return acc;
    }, {} as Record<string, CustomMetric[]>);

    // Calculate statistics
    const stats = Object.entries(groupedMetrics).reduce((acc, [type, metrics]) => {
      acc[type] = {
        count: metrics.length,
        averageValue: metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length,
        minValue: Math.min(...metrics.map(m => m.value)),
        maxValue: Math.max(...metrics.map(m => m.value)),
      };
      return acc;
    }, {} as Record<string, any>);

    return {
      webVitals,
      customMetrics: groupedMetrics,
      statistics: stats,
      summary: {
        totalMetrics: customMetrics.length,
        reportGenerated: new Date().toISOString(),
        performanceScore: this.calculatePerformanceScore(webVitals),
      },
    };
  }

  private calculatePerformanceScore(webVitals: any): number {
    let score = 100;

    // FCP scoring (good: <1.8s, needs improvement: 1.8-3s, poor: >3s)
    if (webVitals.FCP > 3000) score -= 20;
    else if (webVitals.FCP > 1800) score -= 10;

    // LCP scoring (good: <2.5s, needs improvement: 2.5-4s, poor: >4s)
    if (webVitals.LCP > 4000) score -= 25;
    else if (webVitals.LCP > 2500) score -= 15;

    // FID scoring (good: <100ms, needs improvement: 100-300ms, poor: >300ms)
    if (webVitals.FID > 300) score -= 20;
    else if (webVitals.FID > 100) score -= 10;

    // CLS scoring (good: <0.1, needs improvement: 0.1-0.25, poor: >0.25)
    if (webVitals.CLS > 0.25) score -= 15;
    else if (webVitals.CLS > 0.1) score -= 8;

    return Math.max(0, score);
  }

  public async sendMetricsToAnalytics() {
    const report = await this.generateReport();
    
    // Send to analytics service (placeholder implementation)
    try {
      await fetch('/api/analytics/performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(report),
      });
    } catch (error) {
      console.warn('Failed to send metrics to analytics:', error);
    }
  }

  public startPeriodicReporting(intervalMs = 30000) {
    setInterval(async () => {
      this.measureMemoryUsage();
      await this.sendMetricsToAnalytics();
    }, intervalMs);
  }

  public destroy() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.customMetrics = [];
  }
}

// Global instance
export const performanceMonitor = new PerformanceMonitor();

// Utility functions
export function measureAsyncOperation<T>(
  operation: () => Promise<T>,
  name: string,
  tags?: Record<string, string>
): Promise<T> {
  const start = performance.now();
  return operation().finally(() => {
    const duration = performance.now() - start;
    performanceMonitor.measureUserInteraction(name, duration);
  });
}

export function measureSyncOperation<T>(
  operation: () => T,
  name: string,
  tags?: Record<string, string>
): T {
  const start = performance.now();
  try {
    return operation();
  } finally {
    const duration = performance.now() - start;
    performanceMonitor.measureUserInteraction(name, duration);
  }
}

export default performanceMonitor;