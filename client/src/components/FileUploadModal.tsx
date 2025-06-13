import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Upload, X, File, CheckCircle } from "lucide-react";
import { useProjects } from "@/hooks/useFiles";

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UploadFile {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
  error?: string;
}

export default function FileUploadModal({ isOpen, onClose }: FileUploadModalProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: projects = [] } = useProjects();

  const uploadMutation = useMutation({
    mutationFn: async (uploadData: { file: File; projectId?: string; description?: string; tags?: string[] }) => {
      const formData = new FormData();
      formData.append('file', uploadData.file);
      if (uploadData.projectId) formData.append('projectId', uploadData.projectId);
      if (uploadData.description) formData.append('description', uploadData.description);
      if (uploadData.tags) formData.append('tags', JSON.stringify(uploadData.tags));

      const response = await apiRequest('POST', '/api/files/upload', formData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      queryClient.invalidateQueries({ queryKey: ['/api/files/recent'] });
      toast({
        title: "Success",
        description: "Files uploaded successfully!",
      });
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending',
      progress: 0,
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 50 * 1024 * 1024, // 50MB
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/*': ['.txt', '.csv'],
    },
  });

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;

    const tagArray = tags.split(',').map(tag => tag.trim()).filter(Boolean);

    // Update files to uploading status
    setFiles(prev => prev.map(f => ({ ...f, status: 'uploading' as const })));

    for (const fileInfo of files) {
      try {
        await uploadMutation.mutateAsync({
          file: fileInfo.file,
          projectId: projectId || undefined,
          description: description || undefined,
          tags: tagArray.length > 0 ? tagArray : undefined,
        });

        setFiles(prev => prev.map(f => 
          f.id === fileInfo.id ? { ...f, status: 'completed' as const, progress: 100 } : f
        ));
      } catch (error) {
        setFiles(prev => prev.map(f => 
          f.id === fileInfo.id ? { 
            ...f, 
            status: 'error' as const, 
            error: error instanceof Error ? error.message : 'Upload failed'
          } : f
        ));
      }
    }

    // Close modal after a short delay if all uploads completed
    setTimeout(() => {
      setFiles([]);
      setProjectId("");
      setDescription("");
      setTags("");
      onClose();
    }, 1500);
  };

  const handleClose = () => {
    setFiles([]);
    setProjectId("");
    setDescription("");
    setTags("");
    onClose();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Upload className="h-5 w-5 mr-2" />
            Upload Files
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Drop Zone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <div className="text-sm text-gray-600 mb-2">
              <span className="font-medium text-primary cursor-pointer hover:text-primary/80">
                Click to upload
              </span>{' '}
              or drag and drop
            </div>
            <p className="text-xs text-gray-500">
              PNG, JPG, PDF, DOCX up to 50MB
            </p>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {files.map((fileInfo) => (
                <div key={fileInfo.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <File className="h-8 w-8 text-gray-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {fileInfo.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(fileInfo.file.size)}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {fileInfo.status === 'completed' && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                    {fileInfo.status === 'error' && (
                      <div className="text-xs text-red-500">Error</div>
                    )}
                    {fileInfo.status === 'uploading' && (
                      <div className="text-xs text-blue-500">Uploading...</div>
                    )}
                    {fileInfo.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(fileInfo.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="project">Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No project</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description for these files..."
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Add tags separated by commas"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={uploadFiles} 
              disabled={files.length === 0 || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? 'Uploading...' : `Upload ${files.length} File${files.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
