import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePerformance, useMemoryMonitoring } from '@/hooks/usePerformance';
import { RefreshCw, Download, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

export function PerformanceDashboard() {
  const { performanceData, getPerformanceReport, refresh } = usePerformance();
  const { memoryUsage, formatBytes } = useMemoryMonitoring();
  const [isExporting, setIsExporting] = useState(false);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getWebVitalStatus = (metric: string, value: number) => {
    const thresholds = {
      FCP: { good: 1800, poor: 3000 },
      LCP: { good: 2500, poor: 4000 },
      FID: { good: 100, poor: 300 },
      CLS: { good: 0.1, poor: 0.25 },
      TTI: { good: 3800, poor: 7300 },
    };

    const threshold = thresholds[metric as keyof typeof thresholds];
    if (!threshold) return 'unknown';

    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'needs-improvement':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'poor':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  const exportReport = async () => {
    setIsExporting(true);
    try {
      const report = await getPerformanceReport();
      const blob = new Blob([JSON.stringify(report, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `performance-report-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Performance Dashboard</h2>
        <div className="flex gap-2">
          <Button onClick={refresh} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={exportReport} variant="outline" size="sm" disabled={isExporting}>
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export Report'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="web-vitals">Web Vitals</TabsTrigger>
          <TabsTrigger value="custom-metrics">Custom Metrics</TabsTrigger>
          <TabsTrigger value="memory">Memory Usage</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Performance Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <div className={`text-2xl font-bold ${getScoreColor(performanceData.performanceScore)}`}>
                    {performanceData.performanceScore}/100
                  </div>
                  <Progress value={performanceData.performanceScore} className="flex-1" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-2xl font-bold">
                    {memoryUsage.usagePercentage.toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatBytes(memoryUsage.usedJSHeapSize)} / {formatBytes(memoryUsage.jsHeapSizeLimit)}
                  </div>
                  <Progress value={memoryUsage.usagePercentage} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Loading Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  {performanceData.isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm">Loading metrics...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm">Metrics loaded</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="web-vitals" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(performanceData.webVitals).map(([metric, value]) => {
              const status = getWebVitalStatus(metric, value);
              return (
                <Card key={metric}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center justify-between">
                      {metric}
                      {getStatusIcon(status)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-2xl font-bold">
                        {metric === 'CLS' ? value.toFixed(3) : formatDuration(value)}
                      </div>
                      <Badge variant={status === 'good' ? 'default' : status === 'needs-improvement' ? 'secondary' : 'destructive'}>
                        {status.replace('-', ' ')}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Web Vitals Guidelines</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">First Contentful Paint (FCP)</span>
                  <span>Good: &lt;1.8s, Poor: &gt;3.0s</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Largest Contentful Paint (LCP)</span>
                  <span>Good: &lt;2.5s, Poor: &gt;4.0s</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">First Input Delay (FID)</span>
                  <span>Good: &lt;100ms, Poor: &gt;300ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Cumulative Layout Shift (CLS)</span>
                  <span>Good: &lt;0.1, Poor: &gt;0.25</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Time to Interactive (TTI)</span>
                  <span>Good: &lt;3.8s, Poor: &gt;7.3s</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom-metrics" className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {Object.entries(performanceData.customMetrics).map(([type, metrics]) => (
              <Card key={type}>
                <CardHeader>
                  <CardTitle className="capitalize">{type} Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(metrics as any[]).slice(-10).map((metric, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <span className="font-medium">{metric.name}</span>
                        <div className="flex items-center space-x-2">
                          <span>{formatDuration(metric.value)}</span>
                          <Badge variant="outline" className="text-xs">
                            {new Date(metric.timestamp).toLocaleTimeString()}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="memory" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Heap Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Used Heap Size</span>
                    <span className="font-mono">{formatBytes(memoryUsage.usedJSHeapSize)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Heap Size</span>
                    <span className="font-mono">{formatBytes(memoryUsage.totalJSHeapSize)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Heap Size Limit</span>
                    <span className="font-mono">{formatBytes(memoryUsage.jsHeapSizeLimit)}</span>
                  </div>
                  <Progress value={memoryUsage.usagePercentage} />
                  <div className="text-center text-sm text-muted-foreground">
                    {memoryUsage.usagePercentage.toFixed(1)}% of available memory
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Memory Guidelines</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>Good: &lt;50% usage</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-yellow-600" />
                    <span>Warning: 50-80% usage</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span>Critical: &gt;80% usage</span>
                  </div>
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <p className="text-xs">
                      High memory usage can lead to slower performance and potential crashes.
                      Consider implementing code splitting and lazy loading for better memory management.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}