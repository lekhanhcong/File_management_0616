import React, { useState } from 'react';
import { useLocalStorageManager } from '@/hooks/useLocalStorageManager';
import { formatFileSize } from '@/lib/fileUtils';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
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
  HardDrive,
  Database,
  Zap,
  Trash2,
  Settings,
  AlertTriangle,
  CheckCircle,
  Info,
  RefreshCw,
  Download,
  Upload,
  Shield,
  Timer,
} from 'lucide-react';

interface StorageSettingsProps {
  className?: string;
}

export default function StorageSettings({ className }: StorageSettingsProps) {
  const {
    storageInfo,
    settings,
    isNearQuota,
    isCriticalQuota,
    storageHealth,
    optimize,
    clearCache,
    clearAllFiles,
    updateSettings,
    refresh,
  } = useLocalStorageManager();

  const [localSettings, setLocalSettings] = useState(settings);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);

  const handleOptimize = async () => {
    setIsOptimizing(true);
    try {
      await optimize();
    } catch (error) {
      console.error('Optimization failed:', error);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleSaveSettings = () => {
    updateSettings(localSettings);
  };

  const handleClearAll = () => {
    clearAllFiles();
    clearCache();
    setShowClearDialog(false);
  };

  const getStorageStatusColor = () => {
    if (isCriticalQuota) return 'text-red-600';
    if (isNearQuota) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getStorageStatusIcon = () => {
    if (isCriticalQuota) return <AlertTriangle className="w-5 h-5 text-red-500" />;
    if (isNearQuota) return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    return <CheckCircle className="w-5 h-5 text-green-500" />;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Storage Settings</h3>
          <p className="text-sm text-gray-600">Manage your local storage preferences and usage</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Storage Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <HardDrive className="w-5 h-5" />
            <span>Storage Overview</span>
            {getStorageStatusIcon()}
          </CardTitle>
          <CardDescription>Current storage usage and health</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Total Usage */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Total Usage</span>
              <span className={`text-sm font-semibold ${getStorageStatusColor()}`}>
                {formatFileSize(storageInfo.total.used)} / 50 MB
              </span>
            </div>
            <Progress 
              value={storageInfo.total.usedPercentage} 
              className="h-2"
            />
            <p className="text-xs text-gray-500">
              {storageInfo.total.usedPercentage.toFixed(1)}% used • {formatFileSize(storageInfo.total.available)} available
            </p>
          </div>

          <Separator />

          {/* Breakdown */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-blue-500" />
                <span className="text-sm">Files</span>
              </div>
              <div className="text-lg font-semibold">{storageInfo.files.fileCount}</div>
              <p className="text-xs text-gray-500">{formatFileSize(storageInfo.files.used)}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-green-500" />
                <span className="text-sm">Cache</span>
              </div>
              <div className="text-lg font-semibold">{storageInfo.cache.entryCount}</div>
              <p className="text-xs text-gray-500">
                {formatFileSize(storageInfo.cache.size)} • {storageInfo.cache.hitRate.toFixed(1)}% hit rate
              </p>
            </div>
          </div>

          {/* Health Status */}
          <div className="pt-2">
            <div className="flex items-center space-x-2 mb-2">
              <Shield className="w-4 h-4" />
              <span className="text-sm font-medium">Storage Health</span>
              <Badge 
                variant={storageHealth.status === 'good' ? 'default' : 'destructive'}
                className="text-xs"
              >
                {storageHealth.status}
              </Badge>
            </div>
            <div className="text-2xl font-bold">{storageHealth.score}/100</div>
            {storageHealth.issues.length > 0 && (
              <div className="mt-2 space-y-1">
                {storageHealth.issues.map((issue, index) => (
                  <p key={index} className="text-xs text-yellow-600 flex items-center space-x-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{issue}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cache Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="w-5 h-5" />
            <span>Cache Settings</span>
          </CardTitle>
          <CardDescription>Configure caching behavior and limits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Maximum Cache Entries</Label>
              <div className="mt-2">
                <Slider
                  value={[localSettings.maxEntries]}
                  onValueChange={([value]) => 
                    setLocalSettings(prev => ({ ...prev, maxEntries: value }))
                  }
                  max={2000}
                  min={100}
                  step={100}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>100</span>
                  <span className="font-medium">{localSettings.maxEntries}</span>
                  <span>2000</span>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Default TTL (Time to Live)</Label>
              <div className="mt-2 flex items-center space-x-2">
                <Input
                  type="number"
                  value={Math.round(localSettings.defaultTTL / (60 * 60 * 1000))}
                  onChange={(e) => 
                    setLocalSettings(prev => ({ 
                      ...prev, 
                      defaultTTL: parseInt(e.target.value) * 60 * 60 * 1000 
                    }))
                  }
                  min={1}
                  max={168}
                  className="w-20"
                />
                <span className="text-sm text-gray-600">hours</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                How long cache entries remain valid before expiring
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium">Compression Threshold</Label>
              <div className="mt-2">
                <Slider
                  value={[localSettings.compressionThreshold / 1024]}
                  onValueChange={([value]) => 
                    setLocalSettings(prev => ({ 
                      ...prev, 
                      compressionThreshold: value * 1024 
                    }))
                  }
                  max={100} // 100KB
                  min={1} // 1KB
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1 KB</span>
                  <span className="font-medium">{(localSettings.compressionThreshold / 1024).toFixed(0)} KB</span>
                  <span>100 KB</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Files larger than this size will be compressed automatically
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={localSettings.enableCleanup}
                onCheckedChange={(checked) => 
                  setLocalSettings(prev => ({ ...prev, enableCleanup: checked }))
                }
              />
              <div>
                <Label className="text-sm font-medium">Automatic Cleanup</Label>
                <p className="text-xs text-gray-500">
                  Automatically remove expired cache entries
                </p>
              </div>
            </div>

            {localSettings.enableCleanup && (
              <div>
                <Label className="text-sm font-medium">Cleanup Interval</Label>
                <div className="mt-2 flex items-center space-x-2">
                  <Input
                    type="number"
                    value={Math.round(localSettings.cleanupInterval / (60 * 1000))}
                    onChange={(e) => 
                      setLocalSettings(prev => ({ 
                        ...prev, 
                        cleanupInterval: parseInt(e.target.value) * 60 * 1000 
                      }))
                    }
                    min={5}
                    max={180}
                    className="w-20"
                  />
                  <span className="text-sm text-gray-600">minutes</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveSettings}>
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Storage Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>Storage Actions</span>
          </CardTitle>
          <CardDescription>Manage and optimize your storage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              variant="outline" 
              className="h-auto p-4 flex flex-col items-center space-y-2"
              onClick={handleOptimize}
              disabled={isOptimizing}
            >
              <Zap className={`w-6 h-6 ${isOptimizing ? 'animate-pulse' : ''}`} />
              <span className="text-sm font-medium">Optimize Storage</span>
              <span className="text-xs text-gray-500 text-center">
                {isOptimizing ? 'Optimizing...' : 'Clean up and compress data'}
              </span>
            </Button>

            <Button 
              variant="outline" 
              className="h-auto p-4 flex flex-col items-center space-y-2"
              onClick={clearCache}
            >
              <Database className="w-6 h-6" />
              <span className="text-sm font-medium">Clear Cache</span>
              <span className="text-xs text-gray-500 text-center">
                Remove all cached data
              </span>
            </Button>

            <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="h-auto p-4 flex flex-col items-center space-y-2 border-red-200 text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-6 h-6" />
                  <span className="text-sm font-medium">Clear All Data</span>
                  <span className="text-xs text-center">
                    Remove all files and cache
                  </span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    <span>Clear All Storage Data</span>
                  </DialogTitle>
                  <DialogDescription>
                    This action will permanently delete all your locally stored files and cache data. 
                    This cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <Alert>
                  <Info className="w-4 h-4" />
                  <AlertDescription>
                    You will lose:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>{storageInfo.files.fileCount} stored files ({formatFileSize(storageInfo.files.used)})</li>
                      <li>{storageInfo.cache.entryCount} cache entries ({formatFileSize(storageInfo.cache.size)})</li>
                      <li>All storage settings and preferences</li>
                    </ul>
                  </AlertDescription>
                </Alert>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowClearDialog(false)}>
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleClearAll}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear All Data
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Storage Warnings */}
      {(isCriticalQuota || isNearQuota || storageHealth.issues.length > 0) && (
        <Alert className={isCriticalQuota ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'}>
          <AlertTriangle className={`w-4 h-4 ${isCriticalQuota ? 'text-red-500' : 'text-yellow-500'}`} />
          <AlertDescription>
            <div className="space-y-1">
              {isCriticalQuota && (
                <p className="font-medium text-red-700">Storage is critically full</p>
              )}
              {isNearQuota && !isCriticalQuota && (
                <p className="font-medium text-yellow-700">Storage usage is high</p>
              )}
              {storageHealth.issues.map((issue, index) => (
                <p key={index} className="text-sm">{issue}</p>
              ))}
              <div className="mt-2 flex space-x-2">
                <Button 
                  size="sm" 
                  variant={isCriticalQuota ? "destructive" : "default"}
                  onClick={handleOptimize}
                  disabled={isOptimizing}
                >
                  <Zap className="w-3 h-3 mr-1" />
                  Optimize Now
                </Button>
                <Button size="sm" variant="outline" onClick={clearCache}>
                  <Database className="w-3 h-3 mr-1" />
                  Clear Cache
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}