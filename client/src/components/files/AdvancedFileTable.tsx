import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FixedSizeList as List } from 'react-window';
import { 
  flexRender, 
  getCoreRowModel, 
  getSortedRowModel, 
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type RowSelectionState,
} from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/components/ui/context-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Download,
  Share2,
  Star,
  Archive,
  Trash2,
  Edit,
  Eye,
  Copy,
  Move,
  FileText,
  Image,
  Video,
  Music,
  FileArchive,
  File,
  Folder,
  Clock,
  User,
  Calendar,
  HardDrive,
  Tag,
  MessageSquare,
  Activity,
  Filter,
  Search,
  Grid,
  List as ListIcon,
  SortAsc,
  SortDesc,
  RefreshCw,
  Settings,
  X,
} from 'lucide-react';

// Types
interface FileItem {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  projectId?: string;
  uploadedBy: string;
  description?: string;
  tags: string[];
  fileCategory: string;
  customMetadata?: Record<string, any>;
  thumbnailPath?: string;
  previewPath?: string;
  downloadCount: number;
  viewCount: number;
  version: number;
  isActive: boolean;
  isOfflineAvailable: boolean;
  virusScanStatus: 'pending' | 'clean' | 'infected' | 'failed';
  createdAt: string;
  updatedAt: string;
  uploader?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profileImageUrl?: string;
  };
  project?: {
    id: string;
    name: string;
  };
  isStarred?: boolean;
  lastAccessedAt?: string;
  shareLinks?: Array<{
    id: string;
    token: string;
    permissions: string;
    expiresAt?: string;
  }>;
  comments?: Array<{
    id: string;
    content: string;
    userId: string;
    createdAt: string;
  }>;
}

interface FileFilters {
  search?: string;
  fileTypes?: string[];
  categories?: string[];
  tags?: string[];
  uploader?: string;
  project?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  sizeRange?: {
    min: number;
    max: number;
  };
  includeArchived?: boolean;
}

interface SortOptions {
  field: keyof FileItem;
  direction: 'asc' | 'desc';
}

interface AdvancedFileTableProps {
  height?: number;
  showFilters?: boolean;
  showActions?: boolean;
  selectable?: boolean;
  draggable?: boolean;
  viewMode?: 'list' | 'grid';
  onFileSelect?: (file: FileItem) => void;
  onFilesSelect?: (files: FileItem[]) => void;
  onFileAction?: (action: string, files: FileItem[]) => void;
}

// File type icons mapping
const getFileIcon = (mimeType: string, category: string) => {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.startsWith('video/')) return Video;
  if (mimeType.startsWith('audio/')) return Music;
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return FileArchive;
  if (category === 'document') return FileText;
  if (category === 'folder') return Folder;
  return File;
};

// Format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Format date
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffInDays === 0) return 'Today';
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays} days ago`;
  if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
  if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
  return date.toLocaleDateString();
};

export default function AdvancedFileTable({
  height = 600,
  showFilters = true,
  showActions = true,
  selectable = true,
  draggable = false,
  viewMode = 'list',
  onFileSelect,
  onFilesSelect,
  onFileAction,
}: AdvancedFileTableProps) {
  const queryClient = useQueryClient();
  
  // State management
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [filters, setFilters] = useState<FileFilters>({});
  const [currentViewMode, setCurrentViewMode] = useState(viewMode);
  const [pageSize, setPageSize] = useState(50);
  const [refreshing, setRefreshing] = useState(false);

  // Refs
  const listRef = useRef<List>(null);

  // Fetch files data
  const { data: filesData, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/files', { filters, sorting, pageSize }],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      // Add filters
      if (filters.search) params.append('search', filters.search);
      if (filters.fileTypes?.length) params.append('mimeTypes', filters.fileTypes.join(','));
      if (filters.categories?.length) params.append('categories', filters.categories.join(','));
      if (filters.tags?.length) params.append('tags', filters.tags.join(','));
      if (filters.uploader) params.append('uploader', filters.uploader);
      if (filters.project) params.append('projectId', filters.project);
      if (filters.includeArchived) params.append('includeArchived', 'true');
      
      // Add date range
      if (filters.dateRange) {
        params.append('dateFrom', filters.dateRange.start.toISOString());
        params.append('dateTo', filters.dateRange.end.toISOString());
      }
      
      // Add size range
      if (filters.sizeRange) {
        params.append('sizeMin', filters.sizeRange.min.toString());
        params.append('sizeMax', filters.sizeRange.max.toString());
      }
      
      // Add sorting
      if (sorting.length > 0) {
        params.append('sortBy', sorting[0].id);
        params.append('sortOrder', sorting[0].desc ? 'desc' : 'asc');
      }
      
      params.append('limit', pageSize.toString());
      
      const response = await fetch(`/api/files?${params}`);
      if (!response.ok) throw new Error('Failed to fetch files');
      return response.json();
    },
    refetchOnWindowFocus: false,
  });

  // Mutations
  const starFileMutation = useMutation({
    mutationFn: async ({ fileId, starred }: { fileId: string; starred: boolean }) => {
      const response = await fetch(`/api/files/${fileId}/star`, {
        method: starred ? 'POST' : 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to update star status');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
    },
  });

  const deleteFilesMutation = useMutation({
    mutationFn: async (fileIds: string[]) => {
      const response = await fetch('/api/files/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileIds,
          operation: 'delete',
        }),
      });
      if (!response.ok) throw new Error('Failed to delete files');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      setRowSelection({});
    },
  });

  const archiveFilesMutation = useMutation({
    mutationFn: async (fileIds: string[]) => {
      const response = await fetch('/api/files/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileIds,
          operation: 'archive',
        }),
      });
      if (!response.ok) throw new Error('Failed to archive files');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      setRowSelection({});
    },
  });

  // Column definitions
  const columns = useMemo<ColumnDef<FileItem>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 50,
    },
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 p-0 font-medium"
        >
          Name
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      ),
      cell: ({ row }) => {
        const file = row.original;
        const FileIcon = getFileIcon(file.mimeType, file.fileCategory);
        
        return (
          <div className="flex items-center space-x-3 min-w-0">
            {file.thumbnailPath ? (
              <img
                src={file.thumbnailPath}
                alt={file.name}
                className="w-8 h-8 rounded object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                <FileIcon className="w-4 h-4 text-gray-600" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-gray-900 truncate">{file.name}</span>
                {file.isStarred && <Star className="w-4 h-4 text-yellow-400 fill-current flex-shrink-0" />}
                {!file.isActive && <Archive className="w-4 h-4 text-gray-400 flex-shrink-0" />}
              </div>
              {file.description && (
                <p className="text-sm text-gray-500 truncate">{file.description}</p>
              )}
              <div className="flex items-center space-x-2 mt-1">
                {file.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        );
      },
      minSize: 200,
    },
    {
      accessorKey: 'size',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 p-0 font-medium"
        >
          Size
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      ),
      cell: ({ row }) => formatFileSize(row.getValue('size')),
      size: 100,
    },
    {
      accessorKey: 'uploader',
      header: 'Uploaded by',
      cell: ({ row }) => {
        const uploader = row.original.uploader;
        if (!uploader) return '-';
        
        return (
          <div className="flex items-center space-x-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={uploader.profileImageUrl} />
              <AvatarFallback className="text-xs">
                {uploader.firstName?.[0]}{uploader.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm">{uploader.firstName} {uploader.lastName}</span>
          </div>
        );
      },
      size: 150,
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 p-0 font-medium"
        >
          Created
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      ),
      cell: ({ row }) => formatDate(row.getValue('createdAt')),
      size: 120,
    },
    {
      accessorKey: 'project',
      header: 'Project',
      cell: ({ row }) => {
        const project = row.original.project;
        return project ? (
          <Badge variant="outline">{project.name}</Badge>
        ) : (
          <span className="text-gray-400">-</span>
        );
      },
      size: 120,
    },
    {
      accessorKey: 'downloadCount',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 p-0 font-medium"
        >
          Downloads
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center space-x-2">
          <Download className="w-4 h-4 text-gray-400" />
          <span>{row.getValue('downloadCount')}</span>
        </div>
      ),
      size: 100,
    },
    {
      accessorKey: 'virusScanStatus',
      header: 'Security',
      cell: ({ row }) => {
        const status = row.getValue('virusScanStatus') as string;
        const statusConfig = {
          clean: { color: 'bg-green-100 text-green-800', label: 'Clean' },
          pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Scanning' },
          infected: { color: 'bg-red-100 text-red-800', label: 'Infected' },
          failed: { color: 'bg-gray-100 text-gray-800', label: 'Failed' },
        };
        
        const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.failed;
        
        return (
          <Badge className={config.color}>
            {config.label}
          </Badge>
        );
      },
      size: 100,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const file = row.original;
        
        return (
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => handleFileAction('view', [file])}>
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleFileAction('download', [file])}>
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleFileAction('share', [file])}>
                    <Share2 className="mr-2 h-4 w-4" />
                    Share
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => starFileMutation.mutate({ fileId: file.id, starred: !file.isStarred })}>
                    <Star className="mr-2 h-4 w-4" />
                    {file.isStarred ? 'Unstar' : 'Star'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleFileAction('edit', [file])}>
                    <Edit className="mr-2 h-4 w-4" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleFileAction('copy', [file])}>
                    <Copy className="mr-2 h-4 w-4" />
                    Make a copy
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => archiveFilesMutation.mutate([file.id])}>
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => deleteFilesMutation.mutate([file.id])}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => handleFileAction('view', [file])}>
                <Eye className="mr-2 h-4 w-4" />
                View
              </ContextMenuItem>
              <ContextMenuItem onClick={() => handleFileAction('download', [file])}>
                <Download className="mr-2 h-4 w-4" />
                Download
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  <ContextMenuItem onClick={() => handleFileAction('share-link', [file])}>
                    Create share link
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => handleFileAction('share-email', [file])}>
                    Share via email
                  </ContextMenuItem>
                </ContextMenuSubContent>
              </ContextMenuSub>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => handleFileAction('archive', [file])}>
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </ContextMenuItem>
              <ContextMenuItem 
                onClick={() => handleFileAction('delete', [file])}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      },
      enableSorting: false,
      enableHiding: false,
      size: 80,
    },
  ], [starFileMutation, archiveFilesMutation, deleteFilesMutation]);

  // Table configuration
  const table = useReactTable({
    data: filesData?.files || [],
    columns: selectable ? columns : columns.filter(col => col.id !== 'select'),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    enableRowSelection: selectable,
    enableMultiRowSelection: selectable,
  });

  // Event handlers
  const handleFileAction = useCallback((action: string, files: FileItem[]) => {
    onFileAction?.(action, files);
  }, [onFileAction]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleBulkAction = useCallback((action: string) => {
    const selectedFiles = table.getFilteredSelectedRowModel().rows.map(row => row.original);
    if (selectedFiles.length === 0) return;

    switch (action) {
      case 'delete':
        deleteFilesMutation.mutate(selectedFiles.map(f => f.id));
        break;
      case 'archive':
        archiveFilesMutation.mutate(selectedFiles.map(f => f.id));
        break;
      default:
        handleFileAction(action, selectedFiles);
    }
  }, [table, deleteFilesMutation, archiveFilesMutation, handleFileAction]);

  // Virtual list row renderer
  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const row = table.getRowModel().rows[index];
    if (!row) return null;

    return (
      <div
        style={style}
        className={`flex items-center border-b border-gray-100 hover:bg-gray-50 ${
          row.getIsSelected() ? 'bg-blue-50' : ''
        }`}
        onClick={() => {
          if (onFileSelect) {
            onFileSelect(row.original);
          } else {
            row.toggleSelected();
          }
        }}
      >
        {row.getVisibleCells().map((cell, cellIndex) => (
          <div
            key={cell.id}
            className="px-4 py-3 flex items-center"
            style={{ 
              width: cell.column.getSize(),
              minWidth: cell.column.columnDef.minSize,
            }}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </div>
        ))}
      </div>
    );
  }, [table, onFileSelect]);

  // Selected files count
  const selectedFilesCount = table.getFilteredSelectedRowModel().rows.length;

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-600">
        <p>Error loading files: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search files..."
              value={globalFilter ?? ''}
              onChange={(event) => setGlobalFilter(String(event.target.value))}
              className="pl-10 w-64"
            />
          </div>
          
          {showFilters && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Filter Options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {/* Add filter options here */}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center space-x-2">
          {selectedFilesCount > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                {selectedFilesCount} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('download')}
              >
                <Download className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('archive')}
              >
                <Archive className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('delete')}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRowSelection({})}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          <div className="flex items-center space-x-1">
            <Button
              variant={currentViewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentViewMode('list')}
            >
              <ListIcon className="w-4 h-4" />
            </Button>
            <Button
              variant={currentViewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentViewMode('grid')}
            >
              <Grid className="w-4 h-4" />
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* File count and info */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <div>
          {filesData?.total ? (
            <>
              Showing {table.getRowModel().rows.length} of {filesData.total} files
              {globalFilter && ` (filtered)`}
            </>
          ) : (
            'No files found'
          )}
        </div>
        <div className="flex items-center space-x-4">
          <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(Number(value))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="200">200</SelectItem>
            </SelectContent>
          </Select>
          <span>per page</span>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        {/* Header */}
        <div className="bg-gray-50 border-b">
          {table.getHeaderGroups().map((headerGroup) => (
            <div key={headerGroup.id} className="flex">
              {headerGroup.headers.map((header) => (
                <div
                  key={header.id}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  style={{ 
                    width: header.getSize(),
                    minWidth: header.column.columnDef.minSize,
                  }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Body */}
        <div style={{ height: height - 200 }}>
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : table.getRowModel().rows.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <File className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No files found</p>
                <p className="text-sm">Try adjusting your search or filters</p>
              </div>
            </div>
          ) : (
            <List
              ref={listRef}
              height={height - 200}
              itemCount={table.getRowModel().rows.length}
              itemSize={80}
              width="100%"
            >
              {Row}
            </List>
          )}
        </div>
      </div>

      {/* Footer with pagination info */}
      {filesData?.totalPages > 1 && (
        <div className="flex items-center justify-center">
          <p className="text-sm text-gray-600">
            Page {filesData.page} of {filesData.totalPages}
          </p>
        </div>
      )}
    </div>
  );
}