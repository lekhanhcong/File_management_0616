import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { formatFileSize } from '@/lib/fileUtils';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import {
  Share2,
  Upload,
  Download,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  File,
  Folder,
  FolderPlus,
  Users,
  Clock,
  Calendar,
  Star,
  StarOff,
  Lock,
  Unlock,
  Globe,
  Link,
  Copy,
  Check,
  AlertCircle,
  Info,
  Search,
  Filter,
  Grid,
  List,
  SortAsc,
  SortDesc,
  RefreshCw,
  Plus,
  X,
  Shield,
  UserCheck,
  UserX,
  Settings,
  MessageSquare,
  Activity,
} from 'lucide-react';

interface TeamFileSharingProps {
  teamId: string;
  className?: string;
}

interface SharedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  uploaderId: string;
  uploader: {
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  teamId: string;
  projectId?: string;
  project?: {
    name: string;
  };
  isPublic: boolean;
  permissions: {
    canView: boolean;
    canEdit: boolean;
    canDownload: boolean;
    canShare: boolean;
    canComment: boolean;
  };
  sharedWith: {
    userId: string;
    user: {
      firstName: string;
      lastName: string;
      avatar?: string;
    };
    permissions: string[];
    sharedAt: string;
  }[];
  tags: string[];
  description?: string;
  thumbnailUrl?: string;
  downloadCount: number;
  viewCount: number;
  commentCount: number;
  isStarred: boolean;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt?: string;
}

interface FilePermissions {
  canView: boolean;
  canEdit: boolean;
  canDownload: boolean;
  canShare: boolean;
  canComment: boolean;
}

interface ShareSettings {
  isPublic: boolean;
  allowedUsers: string[];
  permissions: FilePermissions;
  expiresAt?: string;
  passwordProtected: boolean;
  downloadLimit?: number;
}

export default function TeamFileSharing({ teamId, className }: TeamFileSharingProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterPermission, setFilterPermission] = useState('all');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [selectedFileForSharing, setSelectedFileForSharing] = useState<string | null>(null);
  const [shareSettings, setShareSettings] = useState<ShareSettings>({
    isPublic: false,
    allowedUsers: [],
    permissions: {
      canView: true,
      canEdit: false,
      canDownload: true,
      canShare: false,
      canComment: true,
    },
    passwordProtected: false,
  });

  // Fetch team files
  const { data: files, isLoading: filesLoading, refetch: refetchFiles } = useQuery({
    queryKey: [`/api/teams/${teamId}/files`, { sortBy, sortOrder, search: searchQuery, type: filterType, permission: filterPermission }],
    queryFn: async () => {
      const params = new URLSearchParams({
        sortBy,
        sortOrder,
        ...(searchQuery && { search: searchQuery }),
        ...(filterType !== 'all' && { type: filterType }),
        ...(filterPermission !== 'all' && { permission: filterPermission }),
      });

      const response = await fetch(`/api/teams/${teamId}/files?${params}`);
      if (!response.ok) throw new Error('Failed to fetch team files');
      return response.json();
    },
    enabled: !!teamId,
  });

  // Fetch team members for sharing
  const { data: teamMembers } = useQuery({
    queryKey: [`/api/teams/${teamId}/members`],
    queryFn: async () => {
      const response = await fetch(`/api/teams/${teamId}/members`);
      if (!response.ok) throw new Error('Failed to fetch team members');
      return response.json();
    },
    enabled: !!teamId,
  });

  // Share file mutation
  const shareFileMutation = useMutation({
    mutationFn: async ({ fileId, settings }: { fileId: string; settings: ShareSettings }) => {
      const response = await fetch(`/api/files/${fileId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error('Failed to share file');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/files`] });
      setShowShareDialog(false);
      setSelectedFileForSharing(null);
    },
  });

  // Update file permissions mutation
  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ fileId, userId, permissions }: { fileId: string; userId: string; permissions: string[] }) => {
      const response = await fetch(`/api/files/${fileId}/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, permissions }),
      });
      if (!response.ok) throw new Error('Failed to update permissions');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/files`] });
    },
  });

  // Star/Unstar file mutation
  const toggleStarMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const response = await fetch(`/api/files/${fileId}/star`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to toggle star');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/files`] });
    },
  });

  // Delete file mutation
  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete file');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/files`] });
      setSelectedFiles(prev => prev.filter(id => id !== fileId));
    },
  });

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-4 h-4 text-green-500" />;
    if (type.startsWith('video/')) return <Video className="w-4 h-4 text-purple-500" />;
    if (type.startsWith('audio/')) return <Music className="w-4 h-4 text-orange-500" />;
    if (type.includes('pdf')) return <FileText className="w-4 h-4 text-red-500" />;
    if (type.includes('zip') || type.includes('rar')) return <Archive className="w-4 h-4 text-gray-500" />;
    return <File className="w-4 h-4 text-blue-500" />;
  };

  const getPermissionBadge = (file: SharedFile) => {
    if (file.isPublic) return <Globe className="w-3 h-3 text-green-500" />;
    if (file.sharedWith.length > 0) return <Users className="w-3 h-3 text-blue-500" />;
    return <Lock className="w-3 h-3 text-gray-500" />;
  };

  const handleShareFile = (fileId: string) => {
    setSelectedFileForSharing(fileId);
    setShowShareDialog(true);
  };

  const handleShare = () => {
    if (selectedFileForSharing) {
      shareFileMutation.mutate({
        fileId: selectedFileForSharing,
        settings: shareSettings,
      });
    }
  };

  const handleBulkAction = (action: string) => {
    switch (action) {
      case 'download':
        selectedFiles.forEach(fileId => {
          // Trigger download for each file
          window.open(`/api/files/${fileId}/download`, '_blank');
        });
        break;
      case 'delete':
        if (confirm(`Delete ${selectedFiles.length} selected files?`)) {
          selectedFiles.forEach(fileId => {
            deleteFileMutation.mutate(fileId);
          });
        }
        break;
      case 'star':
        selectedFiles.forEach(fileId => {
          toggleStarMutation.mutate(fileId);
        });
        break;
    }
  };

  const filteredFiles = files?.files || [];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Team Files</h2>
          <p className="text-gray-600">Shared files and documents within your team</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={() => refetchFiles()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button>
            <Upload className="w-4 h-4 mr-2" />
            Upload File
          </Button>
        </div>
      </div>

      {/* Filters and Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between space-x-4">
            <div className="flex items-center space-x-2 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="document">Documents</SelectItem>
                  <SelectItem value="image">Images</SelectItem>
                  <SelectItem value="video">Videos</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                  <SelectItem value="archive">Archives</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterPermission} onValueChange={setFilterPermission}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Access</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="shared">Shared</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="updatedAt">Modified</SelectItem>
                  <SelectItem value="size">Size</SelectItem>
                  <SelectItem value="downloadCount">Downloads</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
              </Button>

              <div className="flex items-center border rounded">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <List className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedFiles.length > 0 && (
            <div className="flex items-center justify-between mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={selectedFiles.length === filteredFiles.length}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedFiles(filteredFiles.map((f: SharedFile) => f.id));
                    } else {
                      setSelectedFiles([]);
                    }
                  }}
                />
                <span className="text-sm font-medium">
                  {selectedFiles.length} selected
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction('download')}
                >
                  <Download className="w-3 h-3 mr-1" />
                  Download
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction('star')}
                >
                  <Star className="w-3 h-3 mr-1" />
                  Star
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction('delete')}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedFiles([])}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Files Display */}
      <Card>
        <CardContent className="p-0">
          {filesLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No files found</p>
              <p className="text-sm text-gray-400">Upload files to share with your team</p>
            </div>
          ) : viewMode === 'list' ? (
            <div className="divide-y">
              {filteredFiles.map((file: SharedFile) => (
                <div
                  key={file.id}
                  className={`flex items-center space-x-4 p-4 hover:bg-gray-50 ${
                    selectedFiles.includes(file.id) ? 'bg-blue-50' : ''
                  }`}
                >
                  <Checkbox
                    checked={selectedFiles.includes(file.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedFiles(prev => [...prev, file.id]);
                      } else {
                        setSelectedFiles(prev => prev.filter(id => id !== file.id));
                      }
                    }}
                  />

                  <div className="flex-shrink-0">
                    {file.thumbnailUrl ? (
                      <img
                        src={file.thumbnailUrl}
                        alt={file.name}
                        className="w-10 h-10 object-cover rounded"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                        {getFileIcon(file.type)}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                      {getPermissionBadge(file)}
                      {file.isStarred && <Star className="w-3 h-3 text-yellow-500 fill-current" />}
                    </div>
                    <div className="flex items-center space-x-4 mt-1">
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.size)}
                      </p>
                      <div className="flex items-center space-x-1">
                        <Avatar className="w-4 h-4">
                          <AvatarImage src={file.uploader.avatar} />
                          <AvatarFallback className="text-xs">
                            {file.uploader.firstName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-gray-500">
                          {file.uploader.firstName} {file.uploader.lastName}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(file.updatedAt).toLocaleDateString()}
                      </p>
                      {file.project && (
                        <Badge variant="outline" className="text-xs">
                          {file.project.name}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 text-xs text-gray-500">
                    <Eye className="w-3 h-3" />
                    <span>{file.viewCount}</span>
                    <Download className="w-3 h-3 ml-2" />
                    <span>{file.downloadCount}</span>
                    {file.commentCount > 0 && (
                      <>
                        <MessageSquare className="w-3 h-3 ml-2" />
                        <span>{file.commentCount}</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleStarMutation.mutate(file.id)}
                          >
                            {file.isStarred ? (
                              <Star className="w-4 h-4 text-yellow-500 fill-current" />
                            ) : (
                              <StarOff className="w-4 h-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {file.isStarred ? 'Remove from favorites' : 'Add to favorites'}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleShareFile(file.id)}
                    >
                      <Share2 className="w-4 h-4" />
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>File Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => window.open(`/api/files/${file.id}/view`, '_blank')}>
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => window.open(`/api/files/${file.id}/download`, '_blank')}>
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleShareFile(file.id)}>
                          <Share2 className="w-4 h-4 mr-2" />
                          Share
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Comments
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Activity className="w-4 h-4 mr-2" />
                          Activity
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => deleteFileMutation.mutate(file.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
              {filteredFiles.map((file: SharedFile) => (
                <Card
                  key={file.id}
                  className={`cursor-pointer hover:shadow-md transition-shadow ${
                    selectedFiles.includes(file.id) ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => {
                    if (selectedFiles.includes(file.id)) {
                      setSelectedFiles(prev => prev.filter(id => id !== file.id));
                    } else {
                      setSelectedFiles(prev => [...prev, file.id]);
                    }
                  }}
                >
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="relative">
                        {file.thumbnailUrl ? (
                          <img
                            src={file.thumbnailUrl}
                            alt={file.name}
                            className="w-full h-24 object-cover rounded"
                          />
                        ) : (
                          <div className="w-full h-24 bg-gray-100 rounded flex items-center justify-center">
                            {getFileIcon(file.type)}
                          </div>
                        )}
                        <div className="absolute top-2 right-2 flex items-center space-x-1">
                          {getPermissionBadge(file)}
                          {file.isStarred && (
                            <Star className="w-3 h-3 text-yellow-500 fill-current" />
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="font-medium text-sm truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                          <Avatar className="w-4 h-4">
                            <AvatarImage src={file.uploader.avatar} />
                            <AvatarFallback className="text-xs">
                              {file.uploader.firstName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-gray-500">
                            {file.uploader.firstName}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-1 text-xs text-gray-500">
                          <Eye className="w-3 h-3" />
                          <span>{file.viewCount}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share File</DialogTitle>
            <DialogDescription>
              Configure sharing settings for this file
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={shareSettings.isPublic}
                onCheckedChange={(checked) =>
                  setShareSettings(prev => ({ ...prev, isPublic: !!checked }))
                }
              />
              <Label>Make public (anyone with link can access)</Label>
            </div>

            <div>
              <Label>Permissions</Label>
              <div className="space-y-2 mt-2">
                {Object.entries(shareSettings.permissions).map(([key, value]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      checked={value}
                      onCheckedChange={(checked) =>
                        setShareSettings(prev => ({
                          ...prev,
                          permissions: {
                            ...prev.permissions,
                            [key]: !!checked,
                          },
                        }))
                      }
                    />
                    <Label className="text-sm capitalize">
                      {key.replace('can', '').toLowerCase()}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                checked={shareSettings.passwordProtected}
                onCheckedChange={(checked) =>
                  setShareSettings(prev => ({ ...prev, passwordProtected: !!checked }))
                }
              />
              <Label>Password protected</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShareDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleShare}
              disabled={shareFileMutation.isPending}
            >
              {shareFileMutation.isPending ? 'Sharing...' : 'Share'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}