import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

import {
  FileText,
  Table,
  FolderPlus,
  UserPlus,
  Upload,
  Image,
  Video,
  Music,
  Archive,
  Code,
  FileSpreadsheet,
  Presentation,
  Calendar,
  Users,
  Globe,
  Lock,
  Eye,
  EyeOff,
  Plus,
  X,
  Check,
  Loader2,
  Star,
  Sparkles,
  Zap,
  Tag,
  User,
} from 'lucide-react';

// Types and schemas
interface CreateItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'document' | 'spreadsheet' | 'presentation' | 'project' | 'team' | 'folder';
  initialData?: any;
  onSuccess?: (item: any) => void;
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnailUrl?: string;
  isPremium: boolean;
  tags: string[];
  previewUrl?: string;
}

// Validation schemas
const documentSchema = z.object({
  name: z.string().min(1, 'Document name is required').max(255),
  description: z.string().optional(),
  templateId: z.string().optional(),
  projectId: z.string().optional(),
  isPublic: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});

const spreadsheetSchema = z.object({
  name: z.string().min(1, 'Spreadsheet name is required').max(255),
  description: z.string().optional(),
  templateId: z.string().optional(),
  projectId: z.string().optional(),
  isPublic: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});

const presentationSchema = z.object({
  name: z.string().min(1, 'Presentation name is required').max(255),
  description: z.string().optional(),
  templateId: z.string().optional(),
  projectId: z.string().optional(),
  isPublic: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});

const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(255),
  description: z.string().max(1000).optional(),
  organizationId: z.string().optional(),
  teamId: z.string().optional(),
  isPublic: z.boolean().default(false),
  settings: z.object({
    allowFileUploads: z.boolean().default(true),
    allowComments: z.boolean().default(true),
    autoArchive: z.boolean().default(false),
    maxFileSize: z.number().default(100 * 1024 * 1024), // 100MB
  }).optional(),
});

const teamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(255),
  description: z.string().max(1000).optional(),
  slug: z.string().min(3, 'Slug must be at least 3 characters').max(50).regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens allowed'),
  organizationId: z.string().optional(),
  isPublic: z.boolean().default(false),
  settings: z.object({
    defaultFilePermissions: z.object({
      allowDownload: z.boolean().default(true),
      allowShare: z.boolean().default(true),
      allowComment: z.boolean().default(true),
      allowEdit: z.boolean().default(false),
    }),
    allowGuestAccess: z.boolean().default(false),
    maxFileSize: z.number().default(50 * 1024 * 1024), // 50MB
    allowedFileTypes: z.array(z.string()).default([]),
  }).optional(),
});

const folderSchema = z.object({
  name: z.string().min(1, 'Folder name is required').max(255),
  description: z.string().optional(),
  projectId: z.string().optional(),
  parentId: z.string().optional(),
  isPublic: z.boolean().default(false),
});

// Template categories
const templateCategories = {
  document: [
    { id: 'business', name: 'Business', icon: FileText },
    { id: 'personal', name: 'Personal', icon: FileText },
    { id: 'academic', name: 'Academic', icon: FileText },
    { id: 'legal', name: 'Legal', icon: FileText },
  ],
  spreadsheet: [
    { id: 'budget', name: 'Budget & Finance', icon: Table },
    { id: 'analytics', name: 'Analytics', icon: Table },
    { id: 'planning', name: 'Planning', icon: Table },
    { id: 'tracking', name: 'Tracking', icon: Table },
  ],
  presentation: [
    { id: 'business', name: 'Business', icon: Presentation },
    { id: 'education', name: 'Education', icon: Presentation },
    { id: 'marketing', name: 'Marketing', icon: Presentation },
    { id: 'pitch', name: 'Pitch Deck', icon: Presentation },
  ],
};

export default function CreateItemModal({ 
  isOpen, 
  onClose, 
  type, 
  initialData, 
  onSuccess 
}: CreateItemModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [currentTag, setCurrentTag] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Get appropriate schema based on type
  const getSchema = () => {
    switch (type) {
      case 'document': return documentSchema;
      case 'spreadsheet': return spreadsheetSchema;
      case 'presentation': return presentationSchema;
      case 'project': return projectSchema;
      case 'team': return teamSchema;
      case 'folder': return folderSchema;
      default: return documentSchema;
    }
  };

  const form = useForm({
    resolver: zodResolver(getSchema()),
    defaultValues: {
      name: '',
      description: '',
      isPublic: false,
      tags: [],
      ...initialData,
    },
  });

  // Fetch templates
  const { data: templates } = useQuery({
    queryKey: [`/api/templates/${type}`],
    queryFn: async () => {
      const response = await fetch(`/api/templates?type=${type}`);
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json();
    },
    enabled: isOpen && ['document', 'spreadsheet', 'presentation'].includes(type),
  });

  // Fetch projects for selection
  const { data: projects } = useQuery({
    queryKey: ['/api/projects'],
    queryFn: async () => {
      const response = await fetch('/api/projects');
      if (!response.ok) throw new Error('Failed to fetch projects');
      return response.json();
    },
    enabled: isOpen && ['document', 'spreadsheet', 'presentation', 'folder'].includes(type),
  });

  // Fetch teams for selection
  const { data: teams } = useQuery({
    queryKey: ['/api/teams'],
    queryFn: async () => {
      const response = await fetch('/api/teams');
      if (!response.ok) throw new Error('Failed to fetch teams');
      return response.json();
    },
    enabled: isOpen && ['project'].includes(type),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const endpoint = getEndpoint();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          templateId: selectedTemplate?.id,
        }),
      });
      if (!response.ok) throw new Error('Failed to create item');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [getQueryKey()] });
      onSuccess?.(data);
      handleClose();
    },
  });

  const getEndpoint = () => {
    switch (type) {
      case 'document': return '/api/documents';
      case 'spreadsheet': return '/api/spreadsheets';
      case 'presentation': return '/api/presentations';
      case 'project': return '/api/projects';
      case 'team': return '/api/teams';
      case 'folder': return '/api/folders';
      default: return '/api/documents';
    }
  };

  const getQueryKey = () => {
    switch (type) {
      case 'document': return '/api/documents';
      case 'spreadsheet': return '/api/spreadsheets';
      case 'presentation': return '/api/presentations';
      case 'project': return '/api/projects';
      case 'team': return '/api/teams';
      case 'folder': return '/api/folders';
      default: return '/api/documents';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'document': return FileText;
      case 'spreadsheet': return Table;
      case 'presentation': return Presentation;
      case 'project': return FolderPlus;
      case 'team': return UserPlus;
      case 'folder': return FolderPlus;
      default: return FileText;
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'document': return 'Create New Document';
      case 'spreadsheet': return 'Create New Spreadsheet';
      case 'presentation': return 'Create New Presentation';
      case 'project': return 'Create New Project';
      case 'team': return 'Create New Team';
      case 'folder': return 'Create New Folder';
      default: return 'Create New Item';
    }
  };

  const handleClose = () => {
    form.reset();
    setCurrentStep(0);
    setSelectedTemplate(null);
    setCurrentTag('');
    setIsCreating(false);
    onClose();
  };

  const handleNext = () => {
    if (currentStep < getMaxSteps() - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const getMaxSteps = () => {
    if (['document', 'spreadsheet', 'presentation'].includes(type)) {
      return 3; // Template selection, Details, Review
    }
    return 2; // Details, Review
  };

  const handleSubmit = async (data: any) => {
    setIsCreating(true);
    try {
      await createMutation.mutateAsync(data);
    } catch (error) {
      console.error('Creation failed:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const addTag = () => {
    if (currentTag && !(form.getValues('tags') || []).includes(currentTag)) {
      const tags = [...(form.getValues('tags') || []), currentTag];
      form.setValue('tags', tags);
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    const tags = (form.getValues('tags') || []).filter((tag: string) => tag !== tagToRemove);
    form.setValue('tags', tags);
  };

  const IconComponent = getIcon();

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <IconComponent className="w-6 h-6" />
            <span>{getTitle()}</span>
          </DialogTitle>
          <DialogDescription>
            {type === 'team' && 'Create a new team to collaborate with others'}
            {type === 'project' && 'Create a new project to organize your files and documents'}
            {['document', 'spreadsheet', 'presentation'].includes(type) && 'Choose a template or start from scratch'}
            {type === 'folder' && 'Create a new folder to organize your files'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Step {currentStep + 1} of {getMaxSteps()}</span>
            <span>{Math.round(((currentStep + 1) / getMaxSteps()) * 100)}% complete</span>
          </div>
          <Progress value={((currentStep + 1) / getMaxSteps()) * 100} />
        </div>

        <ScrollArea className="max-h-[60vh]">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              
              {/* Step 1: Template Selection (for documents/spreadsheets/presentations) */}
              {currentStep === 0 && ['document', 'spreadsheet', 'presentation'].includes(type) && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Choose a Template</h3>
                    <Tabs defaultValue="blank" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="blank">Start from Blank</TabsTrigger>
                        <TabsTrigger value="templates">Choose Template</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="blank" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div 
                            className={`p-6 border-2 rounded-lg cursor-pointer transition-all ${
                              !selectedTemplate ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => setSelectedTemplate(null)}
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                <IconComponent className="w-6 h-6 text-gray-600" />
                              </div>
                              <div>
                                <h4 className="font-medium">Blank {type.charAt(0).toUpperCase() + type.slice(1)}</h4>
                                <p className="text-sm text-gray-600">Start with a clean slate</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="templates" className="space-y-4">
                        {templates && (
                          <div className="space-y-4">
                            {/* Template categories */}
                            <div className="flex flex-wrap gap-2">
                              {templateCategories[type as keyof typeof templateCategories]?.map((category) => (
                                <Badge key={category.id} variant="outline" className="cursor-pointer">
                                  <category.icon className="w-3 h-3 mr-1" />
                                  {category.name}
                                </Badge>
                              ))}
                            </div>
                            
                            {/* Template grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {templates.map((template: Template) => (
                                <div
                                  key={template.id}
                                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                    selectedTemplate?.id === template.id 
                                      ? 'border-primary bg-primary/5' 
                                      : 'border-gray-200 hover:border-gray-300'
                                  }`}
                                  onClick={() => setSelectedTemplate(template)}
                                >
                                  {template.thumbnailUrl ? (
                                    <img
                                      src={template.thumbnailUrl}
                                      alt={template.name}
                                      className="w-full h-32 object-cover rounded-md mb-3"
                                    />
                                  ) : (
                                    <div className="w-full h-32 bg-gray-100 rounded-md mb-3 flex items-center justify-center">
                                      <IconComponent className="w-8 h-8 text-gray-400" />
                                    </div>
                                  )}
                                  
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <h4 className="font-medium truncate">{template.name}</h4>
                                      {template.isPremium && (
                                        <Badge variant="secondary" className="text-xs">
                                          <Sparkles className="w-3 h-3 mr-1" />
                                          Pro
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-600 line-clamp-2">
                                      {template.description}
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {template.tags.slice(0, 2).map((tag) => (
                                        <Badge key={tag} variant="outline" className="text-xs">
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>
              )}

              {/* Step 2: Basic Details */}
              {((currentStep === 1 && ['document', 'spreadsheet', 'presentation'].includes(type)) || 
                (currentStep === 0 && !['document', 'spreadsheet', 'presentation'].includes(type))) && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name *</FormLabel>
                              <FormControl>
                                <Input placeholder={`Enter ${type} name`} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {type === 'team' && (
                          <FormField
                            control={form.control}
                            name="slug"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Team URL</FormLabel>
                                <FormControl>
                                  <div className="flex">
                                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                                      team/
                                    </span>
                                    <Input 
                                      placeholder="team-slug" 
                                      className="rounded-l-none"
                                      {...field} 
                                    />
                                  </div>
                                </FormControl>
                                <FormDescription>
                                  Only lowercase letters, numbers, and hyphens allowed
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        {['document', 'spreadsheet', 'presentation', 'folder'].includes(type) && projects && (
                          <FormField
                            control={form.control}
                            name="projectId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Project (Optional)</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select a project" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {projects.projects?.map((project: any) => (
                                      <SelectItem key={project.id} value={project.id}>
                                        {project.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        {type === 'project' && teams && (
                          <FormField
                            control={form.control}
                            name="teamId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Team (Optional)</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select a team" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {teams.teams?.map((team: any) => (
                                      <SelectItem key={team.id} value={team.id}>
                                        {team.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                      </div>

                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder={`Enter ${type} description`}
                                  className="resize-none"
                                  rows={4}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Tags */}
                        <div className="space-y-2">
                          <Label>Tags</Label>
                          <div className="flex space-x-2">
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

                        {/* Visibility */}
                        <FormField
                          control={form.control}
                          name="isPublic"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>
                                  Public {type}
                                </FormLabel>
                                <FormDescription>
                                  Anyone can view this {type}
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Final Step: Review and Settings */}
              {currentStep === getMaxSteps() - 1 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Review & Create</h3>
                    <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                      
                      {/* Summary */}
                      <div className="flex items-start space-x-4">
                        <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
                          <IconComponent className="w-8 h-8 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-lg font-medium">{form.watch('name') || `New ${type}`}</h4>
                          {form.watch('description') && (
                            <p className="text-gray-600 mt-1">{form.watch('description')}</p>
                          )}
                          <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                            <div className="flex items-center space-x-1">
                              <User className="w-4 h-4" />
                              <span>Created by {user?.firstName} {user?.lastName}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              {form.watch('isPublic') ? (
                                <>
                                  <Globe className="w-4 h-4" />
                                  <span>Public</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-4 h-4" />
                                  <span>Private</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Template info */}
                      {selectedTemplate && (
                        <div className="border-t pt-4">
                          <div className="flex items-center space-x-3">
                            <Sparkles className="w-5 h-5 text-primary" />
                            <div>
                              <span className="font-medium">Template: {selectedTemplate.name}</span>
                              {selectedTemplate.isPremium && (
                                <Badge variant="secondary" className="ml-2">
                                  <Sparkles className="w-3 h-3 mr-1" />
                                  Pro
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Tags */}
                      {form.watch('tags')?.length > 0 && (
                        <div className="border-t pt-4">
                          <div className="flex items-center space-x-2">
                            <Tag className="w-4 h-4 text-gray-400" />
                            <div className="flex flex-wrap gap-1">
                              {form.watch('tags').map((tag: string) => (
                                <Badge key={tag} variant="outline">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Advanced settings for teams and projects */}
                      {['team', 'project'].includes(type) && (
                        <div className="border-t pt-4 space-y-4">
                          <h5 className="font-medium">Advanced Settings</h5>
                          {/* Add advanced settings based on type */}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </form>
          </Form>
        </ScrollArea>

        <DialogFooter className="flex justify-between">
          <div className="flex space-x-2">
            {currentStep > 0 && (
              <Button variant="outline" onClick={handlePrevious}>
                Previous
              </Button>
            )}
          </div>
          
          <div className="flex space-x-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            {currentStep < getMaxSteps() - 1 ? (
              <Button onClick={handleNext}>
                Next
              </Button>
            ) : (
              <Button 
                onClick={form.handleSubmit(handleSubmit)}
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Create {type.charAt(0).toUpperCase() + type.slice(1)}
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}