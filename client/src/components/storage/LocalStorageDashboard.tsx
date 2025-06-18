import React, { useState, useEffect } from 'react';
import { useLocalStorageManager } from '@/hooks/useLocalStorageManager';
import { formatFileSize } from '@/lib/fileUtils';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import {
  HardDrive,
  Database,
  Zap,
  RefreshCw,
  Download,
  Upload,
  Trash2,
  Settings,
  Activity,
  BarChart3,
  Clock,
  AlertTriangle,
  CheckCircle,
  Info,
  TrendingUp,
  TrendingDown,
  Gauge,
  Archive,
  FileText,
  Cache,
  Optimize,
  Shield,
  Timer,
  Target,
  AlertCircle,
  XCircle,
} from 'lucide-react';

interface LocalStorageDashboardProps {
  className?: string;
}

export default function LocalStorageDashboard({ className }: LocalStorageDashboardProps) {
  const {
    isLoading,
    storageInfo,
    metrics,
    settings,
    files,
    events,
    error,
    isNearQuota,
    isCriticalQuota,
    storageHealth,
    optimize,
    clearCache,
    clearAllFiles,
    updateSettings,
    createBackup,
    restoreBackup,
    refresh,
    clearEvents,
  } = useLocalStorageManager({
    enableRealTimeUpdates: true,
    updateInterval: 3000,
  });

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [backupData, setBackupData] = useState<string>('');
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  // Local settings state
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleOptimize = async () => {
    setIsOptimizing(true);
    try {
      const result = await optimize();
      console.log('Optimization result:', result);
    } catch (error) {
      console.error('Optimization failed:', error);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      const backup = await createBackup();
      setBackupData(JSON.stringify(backup, null, 2));
      setShowBackupDialog(true);
    } catch (error) {
      console.error('Backup creation failed:', error);
    }
  };

  const handleRestoreBackup = async () => {
    if (!backupData.trim()) return;
    
    try {
      const backup = JSON.parse(backupData);
      const result = await restoreBackup(backup);
      if (result.success) {
        setShowRestoreDialog(false);
        setBackupData('');
      }
    } catch (error) {
      console.error('Backup restore failed:', error);
    }
  };

  const handleSaveSettings = () => {
    updateSettings(localSettings);
    setShowSettingsDialog(false);
  };

  const getHealthIcon = () => {
    switch (storageHealth.status) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'good': return <CheckCircle className="w-4 h-4 text-green-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getHealthColor = () => {
    switch (storageHealth.status) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'good': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const recentEvents = events.slice(0, 10);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Local Storage Management</h2>
          <p className="text-gray-600">Monitor and manage your browser's local storage</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOptimize}
            disabled={isOptimizing}
          >
            <Zap className={`w-4 h-4 mr-2 ${isOptimizing ? 'animate-pulse' : ''}`} />
            {isOptimizing ? 'Optimizing...' : 'Optimize'}
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Storage Health Alert */}
      {(isCriticalQuota || isNearQuota) && (
        <Alert className={getHealthColor()}>
          {getHealthIcon()}
          <AlertDescription>
            {isCriticalQuota 
              ? 'Critical: Storage is nearly full. Consider cleaning up files or cache.'
              : 'Warning: Storage usage is high. Optimization recommended.'
            }
          </AlertDescription>
        </Alert>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Storage */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Storage</CardTitle>
            <HardDrive className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatFileSize(storageInfo.total.used)}
            </div>
            <Progress 
              value={storageInfo.total.usedPercentage} 
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {storageInfo.total.usedPercentage.toFixed(1)}% of 50MB used
            </p>
          </CardContent>
        </Card>

        {/* Files */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Files</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{storageInfo.files.fileCount}</div>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(storageInfo.files.used)} used
            </p>
          </CardContent>
        </Card>

        {/* Cache */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache</CardTitle>
            <Database className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{storageInfo.cache.entryCount}</div>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(storageInfo.cache.size)} • {storageInfo.cache.hitRate.toFixed(1)}% hit rate
            </p>
          </CardContent>
        </Card>

        {/* Health Score */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Health Score</CardTitle>
            <Gauge className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center">
              {storageHealth.score}
              {getHealthIcon()}
            </div>
            <p className="text-xs text-muted-foreground">
              {storageHealth.status} status
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="cache">Cache</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Storage Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Storage Breakdown</CardTitle>
                <CardDescription>How your storage is being used</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-blue-500" />
                      <span className="text-sm">Files</span>
                    </div>
                    <div className="text-sm font-medium">
                      {formatFileSize(storageInfo.files.used)}
                    </div>
                  </div>
                  <Progress 
                    value={(storageInfo.files.used / storageInfo.total.used) * 100} 
                    className="h-2"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Database className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Cache</span>
                    </div>
                    <div className="text-sm font-medium">
                      {formatFileSize(storageInfo.cache.size)}
                    </div>
                  </div>
                  <Progress 
                    value={(storageInfo.cache.size / storageInfo.total.used) * 100} 
                    className="h-2"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Health Issues */}
            <Card>
              <CardHeader>
                <CardTitle>Health Issues</CardTitle>
                <CardDescription>Areas that need attention</CardDescription>
              </CardHeader>
              <CardContent>
                {storageHealth.issues.length === 0 ? (
                  <div className="flex items-center space-x-2 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">No issues detected</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {storageHealth.issues.map((issue, index) => (
                      <div key={index} className="flex items-center space-x-2 text-yellow-600">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm">{issue}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common storage management tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Button 
                  variant="outline" 
                  className="h-auto p-4 flex flex-col items-center space-y-2"
                  onClick={handleOptimize}
                  disabled={isOptimizing}
                >
                  <Zap className="w-6 h-6" />
                  <span className="text-sm">Optimize Storage</span>
                </Button>

                <Button 
                  variant="outline" 
                  className="h-auto p-4 flex flex-col items-center space-y-2"
                  onClick={clearCache}
                >
                  <Database className="w-6 h-6" />
                  <span className="text-sm">Clear Cache</span>
                </Button>

                <Button 
                  variant="outline" 
                  className="h-auto p-4 flex flex-col items-center space-y-2"
                  onClick={handleCreateBackup}
                >
                  <Download className="w-6 h-6" />
                  <span className="text-sm">Create Backup</span>
                </Button>

                <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="h-auto p-4 flex flex-col items-center space-y-2"
                    >
                      <Upload className="w-6 h-6" />
                      <span className="text-sm">Restore Backup</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Restore from Backup</DialogTitle>
                      <DialogDescription>
                        Paste your backup data to restore your storage
                      </DialogDescription>
                    </DialogHeader>
                    <Textarea
                      placeholder="Paste backup JSON here..."
                      value={backupData}
                      onChange={(e) => setBackupData(e.target.value)}
                      className="min-h-32"
                    />
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowRestoreDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleRestoreBackup} disabled={!backupData.trim()}>
                        Restore
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Stored Files ({files.length})</CardTitle>
              <CardDescription>Files stored in local browser storage</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                {files.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No files stored locally
                  </div>
                ) : (
                  <div className="space-y-2">
                    {files.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <div className="font-medium text-sm">{file.name}</div>
                          <div className="text-xs text-gray-500">
                            {formatFileSize(file.size)} • {new Date(file.uploadDate).toLocaleDateString()}
                          </div>
                        </div>
                        <Badge variant="outline">{file.type}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cache" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Cache Statistics</CardTitle>
                <CardDescription>Performance metrics for the cache system</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm">Entries:</span>
                  <span className="font-medium">{storageInfo.cache.entryCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Size:</span>
                  <span className="font-medium">{formatFileSize(storageInfo.cache.size)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Hit Rate:</span>
                  <span className="font-medium">{storageInfo.cache.hitRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Compression:</span>
                  <span className="font-medium">{storageInfo.cache.compressionRatio.toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cache Actions</CardTitle>
                <CardDescription>Manage cache data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={clearCache}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear All Cache
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={handleOptimize}
                  disabled={isOptimizing}
                >
                  <Optimize className="w-4 h-4 mr-2" />
                  Optimize Cache
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Storage events and operations</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={clearEvents}>
                Clear
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                {recentEvents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No recent activity
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentEvents.map((event, index) => (
                      <div key={index} className="flex items-center space-x-2 p-2 border rounded text-sm">
                        <Activity className="w-4 h-4 text-blue-500" />
                        <span className="flex-1">{event.type}</span>
                        <span className="text-gray-500">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Storage Settings</CardTitle>
              <CardDescription>Configure local storage behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label>Maximum Cache Entries</Label>
                  <Slider
                    value={[localSettings.maxEntries]}
                    onValueChange={([value]) => 
                      setLocalSettings(prev => ({ ...prev, maxEntries: value }))
                    }
                    max={2000}
                    min={100}
                    step={100}
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Current: {localSettings.maxEntries} entries
                  </p>
                </div>

                <div>
                  <Label>Default TTL (hours)</Label>
                  <Slider
                    value={[localSettings.defaultTTL / (60 * 60 * 1000)]}
                    onValueChange={([value]) => 
                      setLocalSettings(prev => ({ 
                        ...prev, 
                        defaultTTL: value * 60 * 60 * 1000 
                      }))
                    }
                    max={168} // 1 week
                    min={1}
                    step={1}
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Current: {(localSettings.defaultTTL / (60 * 60 * 1000)).toFixed(0)} hours
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={localSettings.enableCleanup}
                    onCheckedChange={(checked) => 
                      setLocalSettings(prev => ({ ...prev, enableCleanup: checked }))
                    }
                  />
                  <Label>Enable automatic cleanup</Label>
                </div>
              </div>

              <Button onClick={handleSaveSettings}>
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Backup Dialog */}
      <Dialog open={showBackupDialog} onOpenChange={setShowBackupDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Storage Backup</DialogTitle>
            <DialogDescription>
              Copy this backup data and save it securely
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={backupData}
            readOnly
            className="min-h-64 font-mono text-xs"
            onClick={(e) => e.currentTarget.select()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBackupDialog(false)}>
              Close
            </Button>
            <Button 
              onClick={() => {
                navigator.clipboard.writeText(backupData);
              }}
            >
              Copy to Clipboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}