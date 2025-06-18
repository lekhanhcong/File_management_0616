import React, { useState, useCallback, useRef, useEffect } from "react";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  X,
  Upload as UploadIcon,
  File,
  CheckCircle,
  AlertCircle,
  HardDrive,
  Info,
  Cloud,
  Image,
  Video,
  Music,
  FileText,
  FileArchive,
  Plus,
  Folder,
  Tag,
  Eye,
  EyeOff,
  Settings,
  Zap,
  Loader2,
  Camera,
  Mic,
  Monitor,
  Smartphone,
  Globe,
  Lock,
  Users,
  Calendar,
  Clock,
  Trash2,
  RefreshCw,
  Download,
  Share2,
  Star,
  MoreHorizontal,
  ChevronDown,
  Search,
  Filter,
  SortAsc,
  Pause,
  Play,
  Square,
} from "lucide-react";

import { localStorageManager } from "@/lib/localStorage";
import { formatFileSize } from "@/lib/fileUtils";

// Enhanced interfaces
interface EnhancedFileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  allowedTypes?: string[];
  maxFileSize?: number;
  multiple?: boolean;
  projectId?: string;
  teamId?: string;
  folderId?: string;
  onSuccess?: (files: any[]) => void;
}

interface UploadFile {
  file: File;
  id: string;
  progress: number;
  status: 'queued' | 'validating' | 'uploading' | 'processing' | 'success' | 'error' | 'paused' | 'cancelled';
  error?: string;
  localStorageId?: string;
  uploadMode: 'server' | 'local';
  projectId?: string;
  teamId?: string;
  folderId?: string;
  tags: string[];
  description?: string;
  isPublic: boolean;
  generateThumbnail: boolean;
  extractMetadata: boolean;
  virusScan: boolean;
  priority: 'low' | 'normal' | 'high';
  expiresAt?: Date;
  metadata?: {
    dimensions?: { width: number; height: number };
    duration?: number;
    thumbnailUrl?: string;
    previewUrl?: string;
  };
}

interface UploadSettings {
  defaultProject?: string;
  defaultTeam?: string;
  defaultFolder?: string;
  autoGenerateThumbnails: boolean;
  autoExtractMetadata: boolean;
  autoVirusScan: boolean;
  defaultTags: string[];
  defaultVisibility: 'private' | 'team' | 'public';
  compressionQuality: number;
  maxConcurrentUploads: number;
  retryAttempts: number;
  chunkSize: number;
}

// Validation schema
const uploadSettingsSchema = z.object({
  projectId: z.string().optional(),
  teamId: z.string().optional(),
  folderId: z.string().optional(),
  tags: z.array(z.string()).default([]),
  description: z.string().optional(),
  isPublic: z.boolean().default(false),
  generateThumbnail: z.boolean().default(true),
  extractMetadata: z.boolean().default(true),
  virusScan: z.boolean().default(true),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  expiresAt: z.date().optional(),
});

// File type configurations
const fileTypeConfigs = {
  image: {
    icon: Image,
    color: 'text-green-600 bg-green-100',
    types: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    maxSize: 10 * 1024 * 1024, // 10MB
  },
  video: {
    icon: Video,
    color: 'text-purple-600 bg-purple-100',
    types: ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov'],
    maxSize: 100 * 1024 * 1024, // 100MB
  },
  audio: {
    icon: Music,
    color: 'text-orange-600 bg-orange-100',
    types: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a'],
    maxSize: 50 * 1024 * 1024, // 50MB
  },
  document: {
    icon: FileText,
    color: 'text-blue-600 bg-blue-100',
    types: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    maxSize: 25 * 1024 * 1024, // 25MB
  },
  archive: {
    icon: FileArchive,
    color: 'text-gray-600 bg-gray-100',
    types: ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'],
    maxSize: 200 * 1024 * 1024, // 200MB
  },
  other: {
    icon: File,
    color: 'text-gray-600 bg-gray-100',
    types: [],
    maxSize: 50 * 1024 * 1024, // 50MB
  },
};

export default function EnhancedFileUploadModal({ 
  isOpen, 
  onClose, 
  allowedTypes = [],
  maxFileSize = 100 * 1024 * 1024,
  multiple = true,
  projectId,
  teamId,
  folderId,
  onSuccess
}: EnhancedFileUploadModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // State management
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadMode, setUploadMode] = useState<'server' | 'local'>('server');
  const [storageInfo, setStorageInfo] = useState(localStorageManager.getStorageInfo());
  const [currentStep, setCurrentStep] = useState<'select' | 'configure' | 'upload' | 'complete'>('select');
  const [uploadQueue, setUploadQueue] = useState<UploadFile[]>([]);
  const [activeUploads, setActiveUploads] = useState<Set<string>>(new Set());
  const [currentTag, setCurrentTag] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFileTypes, setSelectedFileTypes] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'type' | 'date'>('name');
  const [showSettings, setShowSettings] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropzoneRef = useRef<HTMLDivElement>(null);
  const webcamRef = useRef<HTMLVideoElement>(null);
  
  // Settings
  const [settings, setSettings] = useState<UploadSettings>({
    defaultProject: projectId,
    defaultTeam: teamId,
    defaultFolder: folderId,
    autoGenerateThumbnails: true,
    autoExtractMetadata: true,
    autoVirusScan: true,
    defaultTags: [],
    defaultVisibility: 'private',
    compressionQuality: 80,
    maxConcurrentUploads: 3,
    retryAttempts: 3,
    chunkSize: 1024 * 1024, // 1MB chunks
  });

  // Form for upload configuration
  const form = useForm({
    resolver: zodResolver(uploadSettingsSchema),
    defaultValues: {
      projectId: projectId,
      teamId: teamId,
      folderId: folderId,
      tags: [],
      isPublic: false,
      generateThumbnail: true,
      extractMetadata: true,
      virusScan: true,
      priority: 'normal' as const,
    },
  });

  // Fetch data
  const { data: projects } = useQuery({
    queryKey: ['/api/projects'],
    queryFn: async () => {
      const response = await fetch('/api/projects');
      if (!response.ok) throw new Error('Failed to fetch projects');
      return response.json();
    },
    enabled: isOpen,
  });

  const { data: teams } = useQuery({
    queryKey: ['/api/teams'],
    queryFn: async () => {
      const response = await fetch('/api/teams');
      if (!response.ok) throw new Error('Failed to fetch teams');
      return response.json();
    },
    enabled: isOpen,
  });

  const { data: folders } = useQuery({
    queryKey: ['/api/folders', form.watch('projectId')],
    queryFn: async () => {
      const projectId = form.watch('projectId');
      if (!projectId) return { folders: [] };
      const response = await fetch(`/api/folders?projectId=${projectId}`);
      if (!response.ok) throw new Error('Failed to fetch folders');
      return response.json();
    },
    enabled: isOpen && !!form.watch('projectId'),
  });

  // Mutations
  const uploadMutation = useMutation({
    mutationFn: async (uploadFile: UploadFile) => {
      if (uploadFile.uploadMode === 'local') {
        return await uploadToLocal(uploadFile);
      } else {
        return await uploadToServer(uploadFile);
      }
    },
    onSuccess: (data, uploadFile) => {
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: 'success', progress: 100, ...data }
          : f
      ));
      setActiveUploads(prev => {
        const next = new Set(prev);
        next.delete(uploadFile.id);
        return next;
      });
      processNextInQueue();
    },
    onError: (error: Error, uploadFile) => {
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: 'error', error: error.message }
          : f
      ));
      setActiveUploads(prev => {
        const next = new Set(prev);
        next.delete(uploadFile.id);
        return next;
      });
      processNextInQueue();
    }
  });

  // Upload functions
  const uploadToServer = async (uploadFile: UploadFile): Promise<any> => {
    const formData = new FormData();
    formData.append('files', uploadFile.file);
    formData.append('projectId', uploadFile.projectId || '');
    formData.append('teamId', uploadFile.teamId || '');
    formData.append('folderId', uploadFile.folderId || '');
    formData.append('description', uploadFile.description || '');
    formData.append('tags', JSON.stringify(uploadFile.tags));
    formData.append('isPublic', uploadFile.isPublic.toString());
    formData.append('generateThumbnail', uploadFile.generateThumbnail.toString());
    formData.append('extractMetadata', uploadFile.extractMetadata.toString());
    formData.append('virusScan', uploadFile.virusScan.toString());
    formData.append('priority', uploadFile.priority);

    const xhr = new XMLHttpRequest();
    
    return new Promise((resolve, reject) => {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          updateFileProgress(uploadFile.id, progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error(xhr.statusText));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      xhr.open('POST', '/api/files/upload');
      xhr.send(formData);
    });
  };

  const uploadToLocal = async (uploadFile: UploadFile): Promise<any> => {
    // Simulate chunked upload with progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      updateFileProgress(uploadFile.id, i);
      if (uploadFile.status === 'cancelled') {
        throw new Error('Upload cancelled');
      }
    }

    const result = await localStorageManager.storeFile(uploadFile.file);
    if (!result.success) {
      throw new Error(result.error || 'Local storage failed');
    }

    return { fileId: result.fileId };
  };

  // Helper functions
  const updateFileProgress = (fileId: string, progress: number) => {
    setFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, progress } : f
    ));
  };

  const processNextInQueue = () => {
    if (isPaused) return;
    
    const maxConcurrent = settings.maxConcurrentUploads;
    const currentActive = activeUploads.size;
    
    if (currentActive < maxConcurrent) {
      const nextFile = uploadQueue.find(f => f.status === 'queued');
      if (nextFile) {
        setActiveUploads(prev => new Set([...prev, nextFile.id]));
        setFiles(prev => prev.map(f => 
          f.id === nextFile.id ? { ...f, status: 'uploading' } : f
        ));
        uploadMutation.mutate(nextFile);
      }
    }
  };

  const getFileTypeCategory = (mimeType: string): keyof typeof fileTypeConfigs => {
    for (const [category, config] of Object.entries(fileTypeConfigs)) {
      if (config.types.includes(mimeType)) {
        return category as keyof typeof fileTypeConfigs;
      }
    }
    return 'other';
  };

  const validateFile = (file: File): { isValid: boolean; error?: string } => {
    // Size validation
    const category = getFileTypeCategory(file.type);
    const maxSize = fileTypeConfigs[category].maxSize;
    if (file.size > maxSize) {
      return { 
        isValid: false, 
        error: `File size exceeds ${formatFileSize(maxSize)} limit for ${category} files` 
      };
    }

    // Type validation
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      return { 
        isValid: false, 
        error: `File type ${file.type} is not allowed` 
      };
    }

    // Local storage validation
    if (uploadMode === 'local') {
      const localSettings = localStorageManager.getSettings();
      if (!localSettings.allowedTypes.includes(file.type)) {
        return { 
          isValid: false, 
          error: `File type not supported in local storage` 
        };
      }
    }

    return { isValid: true };
  };

  const addFiles = useCallback(async (newFiles: File[]) => {
    const formData = form.getValues();
    const uploadFiles: UploadFile[] = [];
    
    for (const file of newFiles) {
      const validation = validateFile(file);
      const fileId = Math.random().toString(36).substr(2, 9);
      
      const uploadFile: UploadFile = {
        file,
        id: fileId,
        progress: 0,
        status: validation.isValid ? 'queued' : 'error',
        error: validation.error,
        uploadMode,
        projectId: formData.projectId,
        teamId: formData.teamId,
        folderId: formData.folderId,
        tags: formData.tags,
        description: formData.description,
        isPublic: formData.isPublic,
        generateThumbnail: formData.generateThumbnail,
        extractMetadata: formData.extractMetadata,
        virusScan: formData.virusScan,
        priority: formData.priority,
        expiresAt: formData.expiresAt,
      };
      
      // Extract metadata for preview
      if (file.type.startsWith('image/')) {
        const img = new Image();
        img.onload = () => {
          setFiles(prev => prev.map(f => 
            f.id === fileId 
              ? { 
                  ...f, 
                  metadata: { 
                    ...f.metadata, 
                    dimensions: { width: img.width, height: img.height },
                    thumbnailUrl: URL.createObjectURL(file)
                  } 
                }
              : f
          ));
        };
        img.src = URL.createObjectURL(file);
      }
      
      uploadFiles.push(uploadFile);
    }
    
    setFiles(prev => [...prev, ...uploadFiles]);
    setUploadQueue(prev => [...prev, ...uploadFiles.filter(f => f.status === 'queued')]);
  }, [uploadMode, form]);

  // Event handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, [addFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const startUpload = () => {
    setCurrentStep('upload');
    processNextInQueue();
  };

  const pauseUpload = () => {
    setIsPaused(true);
  };

  const resumeUpload = () => {
    setIsPaused(false);
    processNextInQueue();
  };

  const cancelUpload = (fileId: string) => {
    setFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, status: 'cancelled' } : f
    ));
    setUploadQueue(prev => prev.filter(f => f.id !== fileId));
  };

  const retryUpload = (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (file) {
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { ...f, status: 'queued', progress: 0, error: undefined } : f
      ));
      setUploadQueue(prev => [...prev, file]);
      processNextInQueue();
    }
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    setUploadQueue(prev => prev.filter(f => f.id !== fileId));
  };

  const addTag = () => {
    if (currentTag && !form.getValues('tags').includes(currentTag)) {
      const tags = [...form.getValues('tags'), currentTag];
      form.setValue('tags', tags);
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    const tags = form.getValues('tags').filter(tag => tag !== tagToRemove);
    form.setValue('tags', tags);
  };

  const handleClose = () => {
    setFiles([]);
    setUploadQueue([]);
    setActiveUploads(new Set());
    setCurrentStep('select');
    setIsPaused(false);
    form.reset();
    onClose();
  };

  // Filter and sort files
  const filteredFiles = files.filter(file => {
    if (searchQuery && !file.file.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (selectedFileTypes.length > 0) {
      const category = getFileTypeCategory(file.file.type);
      if (!selectedFileTypes.includes(category)) {
        return false;
      }
    }
    return true;
  });

  const sortedFiles = [...filteredFiles].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.file.name.localeCompare(b.file.name);
      case 'size':
        return b.file.size - a.file.size;
      case 'type':
        return a.file.type.localeCompare(b.file.type);
      case 'date':
        return a.file.lastModified - b.file.lastModified;
      default:
        return 0;
    }
  });

  // Statistics
  const totalFiles = files.length;
  const successfulFiles = files.filter(f => f.status === 'success').length;
  const failedFiles = files.filter(f => f.status === 'error').length;
  const uploadingFiles = files.filter(f => f.status === 'uploading').length;
  const queuedFiles = files.filter(f => f.status === 'queued').length;
  const totalSize = files.reduce((acc, f) => acc + f.file.size, 0);
  const overallProgress = totalFiles > 0 ? (successfulFiles / totalFiles) * 100 : 0;

  useEffect(() => {
    if (isOpen) {
      setStorageInfo(localStorageManager.getStorageInfo());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center space-x-2">
              <UploadIcon className="w-6 h-6" />
              <span>Enhanced File Upload</span>
              {totalFiles > 0 && (
                <Badge variant="secondary">
                  {totalFiles} file{totalFiles !== 1 ? 's' : ''}
                </Badge>
              )}
            </DialogTitle>
            <div className="flex items-center space-x-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={uploadMode === 'server' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setUploadMode('server')}
                    >
                      <Cloud className="w-4 h-4 mr-1" />
                      Server
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Upload to cloud server</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={uploadMode === 'local' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setUploadMode('local')}
                    >
                      <HardDrive className="w-4 h-4 mr-1" />
                      Local
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Store in browser local storage</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Mode info */}
          {uploadMode === 'local' && (
            <Alert>
              <HardDrive className="h-4 w-4" />
              <AlertDescription>
                Files will be stored locally in your browser. 
                Storage used: {Math.round(storageInfo.usedPercentage)}% 
                ({formatFileSize(storageInfo.used)} / {formatFileSize(50 * 1024 * 1024)})
              </AlertDescription>
            </Alert>
          )}

          {/* Progress overview */}
          {totalFiles > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Upload Progress</span>
                <span className="text-sm text-gray-600">
                  {successfulFiles}/{totalFiles} completed
                </span>
              </div>
              <Progress value={overallProgress} className="mb-2" />
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>{formatFileSize(totalSize)} total</span>
                <div className="flex space-x-4">
                  {uploadingFiles > 0 && <span>Uploading: {uploadingFiles}</span>}
                  {queuedFiles > 0 && <span>Queued: {queuedFiles}</span>}
                  {failedFiles > 0 && <span className="text-red-600">Failed: {failedFiles}</span>}
                </div>
              </div>
            </div>
          )}

          <Tabs value={currentStep} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="select">Select Files</TabsTrigger>
              <TabsTrigger value="configure">Configure</TabsTrigger>
              <TabsTrigger value="upload">Upload</TabsTrigger>
              <TabsTrigger value="complete">Complete</TabsTrigger>
            </TabsList>

            {/* Step 1: File Selection */}
            <TabsContent value="select" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Drop zone */}
                <div className="lg:col-span-2">
                  <div
                    ref={dropzoneRef}
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      isDragOver 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <UploadIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-lg font-medium text-gray-900 mb-2">
                      Drop files here or click to browse
                    </p>
                    <p className="text-sm text-gray-500 mb-4">
                      Supports multiple file types up to {formatFileSize(maxFileSize)}
                    </p>
                    <div className="flex justify-center space-x-2">
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        variant="outline"
                      >
                        <Folder className="w-4 h-4 mr-2" />
                        Browse Files
                      </Button>
                      <Button
                        onClick={() => {/* Implement URL upload */}}
                        variant="outline"
                      >
                        <Globe className="w-4 h-4 mr-2" />
                        From URL
                      </Button>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple={multiple}
                      onChange={handleFileSelect}
                      className="hidden"
                      accept={allowedTypes.join(',')}
                    />
                  </div>
                </div>

                {/* Quick options */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">File Types</h3>
                    <div className="space-y-2">
                      {Object.entries(fileTypeConfigs).map(([type, config]) => {
                        const IconComponent = config.icon;
                        return (
                          <label key={type} className="flex items-center space-x-2 cursor-pointer">
                            <Checkbox
                              checked={selectedFileTypes.includes(type)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedFileTypes([...selectedFileTypes, type]);
                                } else {
                                  setSelectedFileTypes(selectedFileTypes.filter(t => t !== type));
                                }
                              }}
                            />
                            <div className={`w-6 h-6 rounded flex items-center justify-center ${config.color}`}>
                              <IconComponent className="w-4 h-4" />
                            </div>
                            <span className="text-sm capitalize">{type}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {uploadMode === 'server' && (
                    <div>
                      <h3 className="text-sm font-medium mb-2">Quick Settings</h3>
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2">
                          <Checkbox {...form.register('generateThumbnail')} />
                          <span className="text-sm">Generate thumbnails</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <Checkbox {...form.register('extractMetadata')} />
                          <span className="text-sm">Extract metadata</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <Checkbox {...form.register('virusScan')} />
                          <span className="text-sm">Virus scan</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Selected files preview */}
              {files.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Selected Files ({files.length})</h3>
                    <div className="flex items-center space-x-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          placeholder="Search files..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 w-48"
                        />
                      </div>
                      <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="name">Name</SelectItem>
                          <SelectItem value="size">Size</SelectItem>
                          <SelectItem value="type">Type</SelectItem>
                          <SelectItem value="date">Date</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <ScrollArea className="h-64">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {sortedFiles.map((uploadFile) => {
                        const category = getFileTypeCategory(uploadFile.file.type);
                        const config = fileTypeConfigs[category];
                        const IconComponent = config.icon;

                        return (
                          <div key={uploadFile.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                            <div className="flex-shrink-0">
                              {uploadFile.metadata?.thumbnailUrl ? (
                                <img
                                  src={uploadFile.metadata.thumbnailUrl}
                                  alt={uploadFile.file.name}
                                  className="w-10 h-10 object-cover rounded"
                                />
                              ) : (
                                <div className={`w-10 h-10 rounded flex items-center justify-center ${config.color}`}>
                                  <IconComponent className="w-5 h-5" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {uploadFile.file.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatFileSize(uploadFile.file.size)}
                                {uploadFile.metadata?.dimensions && (
                                  <span> • {uploadFile.metadata.dimensions.width}×{uploadFile.metadata.dimensions.height}</span>
                                )}
                              </p>
                              {uploadFile.status === 'error' && (
                                <p className="text-xs text-red-500">{uploadFile.error}</p>
                              )}
                            </div>
                            <div className="flex items-center space-x-1">
                              {uploadFile.status === 'error' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => retryUpload(uploadFile.id)}
                                >
                                  <RefreshCw className="w-3 h-3" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFile(uploadFile.id)}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>

                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setFiles([])}>
                      Clear All
                    </Button>
                    <Button 
                      onClick={() => setCurrentStep('configure')}
                      disabled={files.filter(f => f.status !== 'error').length === 0}
                    >
                      Next: Configure
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Step 2: Configuration */}
            <TabsContent value="configure" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Upload Settings</h3>
                  
                  {/* Project/Team/Folder selection */}
                  <div className="space-y-3">
                    {projects && (
                      <div>
                        <Label htmlFor="projectId">Project</Label>
                        <Select 
                          value={form.watch('projectId') || ''} 
                          onValueChange={(value) => form.setValue('projectId', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a project" />
                          </SelectTrigger>
                          <SelectContent>
                            {projects.projects?.map((project: any) => (
                              <SelectItem key={project.id} value={project.id}>
                                {project.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {teams && (
                      <div>
                        <Label htmlFor="teamId">Team</Label>
                        <Select 
                          value={form.watch('teamId') || ''} 
                          onValueChange={(value) => form.setValue('teamId', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a team" />
                          </SelectTrigger>
                          <SelectContent>
                            {teams.teams?.map((team: any) => (
                              <SelectItem key={team.id} value={team.id}>
                                {team.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {folders && folders.folders?.length > 0 && (
                      <div>
                        <Label htmlFor="folderId">Folder</Label>
                        <Select 
                          value={form.watch('folderId') || ''} 
                          onValueChange={(value) => form.setValue('folderId', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a folder" />
                          </SelectTrigger>
                          <SelectContent>
                            {folders.folders.map((folder: any) => (
                              <SelectItem key={folder.id} value={folder.id}>
                                {folder.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      {...form.register('description')}
                      placeholder="Add a description for all files"
                      rows={3}
                    />
                  </div>

                  {/* Tags */}
                  <div>
                    <Label>Tags</Label>
                    <div className="flex space-x-2 mb-2">
                      <Input
                        placeholder="Add tag"
                        value={currentTag}
                        onChange={(e) => setCurrentTag(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addTag();
                          }
                        }}
                      />
                      <Button type="button" onClick={addTag} size="sm">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    {form.watch('tags')?.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {(form.watch('tags') || []).map((tag: string) => (
                          <Badge key={tag} variant="secondary" className="flex items-center space-x-1">
                            <Tag className="w-3 h-3" />
                            <span>{tag}</span>
                            <button
                              type="button"
                              onClick={() => removeTag(tag)}
                              className="ml-1 hover:text-red-600"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Advanced Options</h3>
                  
                  {/* Visibility */}
                  <div>
                    <Label>Visibility</Label>
                    <RadioGroup 
                      value={form.watch('isPublic') ? 'public' : 'private'}
                      onValueChange={(value) => form.setValue('isPublic', value === 'public')}
                      className="mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="private" id="private" />
                        <Label htmlFor="private" className="flex items-center space-x-2">
                          <Lock className="w-4 h-4" />
                          <span>Private</span>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="public" id="public" />
                        <Label htmlFor="public" className="flex items-center space-x-2">
                          <Globe className="w-4 h-4" />
                          <span>Public</span>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Processing options */}
                  <div className="space-y-3">
                    <Label>Processing Options</Label>
                    <div className="space-y-2">
                      <label className="flex items-center space-x-2">
                        <Checkbox {...form.register('generateThumbnail')} />
                        <span className="text-sm">Generate thumbnails</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <Checkbox {...form.register('extractMetadata')} />
                        <span className="text-sm">Extract metadata</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <Checkbox {...form.register('virusScan')} />
                        <span className="text-sm">Virus scan</span>
                      </label>
                    </div>
                  </div>

                  {/* Priority */}
                  <div>
                    <Label htmlFor="priority">Upload Priority</Label>
                    <Select 
                      value={form.watch('priority')} 
                      onValueChange={(value: any) => form.setValue('priority', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button 
                  variant="outline" 
                  onClick={() => setCurrentStep('select')}
                >
                  Back
                </Button>
                <Button onClick={() => {
                  // Apply settings to all files
                  const formData = form.getValues();
                  setFiles(prev => prev.map(f => ({
                    ...f,
                    ...formData,
                  })));
                  startUpload();
                }}>
                  Start Upload
                </Button>
              </div>
            </TabsContent>

            {/* Step 3: Upload Progress */}
            <TabsContent value="upload" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Upload Progress</h3>
                <div className="flex space-x-2">
                  {isPaused ? (
                    <Button onClick={resumeUpload} size="sm">
                      <Play className="w-4 h-4 mr-1" />
                      Resume
                    </Button>
                  ) : (
                    <Button onClick={pauseUpload} size="sm" variant="outline">
                      <Pause className="w-4 h-4 mr-1" />
                      Pause
                    </Button>
                  )}
                  <Button 
                    onClick={() => {
                      // Cancel all uploads
                      files.forEach(f => {
                        if (f.status === 'uploading' || f.status === 'queued') {
                          cancelUpload(f.id);
                        }
                      });
                    }} 
                    size="sm" 
                    variant="outline"
                  >
                    <Square className="w-4 h-4 mr-1" />
                    Cancel All
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {files.map((uploadFile) => {
                    const category = getFileTypeCategory(uploadFile.file.type);
                    const config = fileTypeConfigs[category];
                    const IconComponent = config.icon;

                    return (
                      <div key={uploadFile.id} className="flex items-center space-x-3 p-4 border rounded-lg">
                        <div className="flex-shrink-0">
                          {uploadFile.metadata?.thumbnailUrl ? (
                            <img
                              src={uploadFile.metadata.thumbnailUrl}
                              alt={uploadFile.file.name}
                              className="w-12 h-12 object-cover rounded"
                            />
                          ) : (
                            <div className={`w-12 h-12 rounded flex items-center justify-center ${config.color}`}>
                              <IconComponent className="w-6 h-6" />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {uploadFile.file.name}
                            </p>
                            <div className="flex items-center space-x-2">
                              <Badge 
                                variant={
                                  uploadFile.status === 'success' ? 'default' :
                                  uploadFile.status === 'error' ? 'destructive' :
                                  uploadFile.status === 'uploading' ? 'secondary' :
                                  'outline'
                                }
                              >
                                {uploadFile.status}
                              </Badge>
                              
                              {uploadFile.status === 'success' && (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              )}
                              {uploadFile.status === 'error' && (
                                <AlertCircle className="w-4 h-4 text-red-500" />
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>{formatFileSize(uploadFile.file.size)}</span>
                            <span>{uploadFile.progress}%</span>
                          </div>
                          
                          {uploadFile.status === 'uploading' && (
                            <Progress value={uploadFile.progress} className="h-2" />
                          )}
                          
                          {uploadFile.status === 'error' && (
                            <p className="text-xs text-red-500">{uploadFile.error}</p>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-1">
                          {uploadFile.status === 'error' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => retryUpload(uploadFile.id)}
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                          )}
                          {(uploadFile.status === 'uploading' || uploadFile.status === 'queued') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => cancelUpload(uploadFile.id)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Upload complete check */}
              {files.length > 0 && files.every(f => ['success', 'error', 'cancelled'].includes(f.status)) && (
                <div className="flex justify-end">
                  <Button onClick={() => setCurrentStep('complete')}>
                    View Results
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Step 4: Complete */}
            <TabsContent value="complete" className="space-y-4">
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Upload Complete!</h3>
                <p className="text-gray-600 mb-4">
                  {successfulFiles} of {totalFiles} files uploaded successfully
                </p>
                
                {failedFiles > 0 && (
                  <Alert className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {failedFiles} files failed to upload. You can retry them or review the errors.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-center space-x-3">
                  <Button onClick={handleClose}>
                    Done
                  </Button>
                  <Button variant="outline" onClick={() => setCurrentStep('select')}>
                    Upload More Files
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}