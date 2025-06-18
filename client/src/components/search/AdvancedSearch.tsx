import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/use-debounce';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

import {
  Search,
  Filter,
  X,
  Calendar as CalendarIcon,
  Clock,
  User,
  Folder,
  Tag,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  Code,
  File,
  Star,
  Download,
  Eye,
  Share2,
  Grid,
  List,
  SortAsc,
  SortDesc,
  ChevronDown,
  Settings,
  Bookmark,
  History,
  Zap,
  Sparkles,
  TrendingUp,
  BarChart3,
  PieChart,
  Activity,
  Target,
  Layers,
  Globe,
  Lock,
  Users,
  Building,
  Map,
  Compass,
  Lightbulb,
  Brain,
  Wand2,
} from 'lucide-react';

// Types
interface SearchFilters {
  query: string;
  fileTypes: string[];
  categories: string[];
  tags: string[];
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  sizeRange: {
    min: number;
    max: number;
  };
  uploader: string[];
  projects: string[];
  teams: string[];
  lastModified: string;
  hasComments: boolean;
  isStarred: boolean;
  isShared: boolean;
  hasPreview: boolean;
  contentType: 'all' | 'files' | 'projects' | 'teams' | 'users';
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  includeArchived: boolean;
  includeDeleted: boolean;
}

interface SearchResult {
  id: string;
  type: 'file' | 'project' | 'team' | 'user' | 'folder';
  title: string;
  description?: string;
  thumbnailUrl?: string;
  path: string;
  uploader?: {
    id: string;
    name: string;
    avatar?: string;
  };
  createdAt: string;
  updatedAt: string;
  size?: number;
  tags: string[];
  highlight?: {
    title?: string;
    content?: string;
    description?: string;
  };
  metadata?: Record<string, any>;
  relevanceScore: number;
}

interface SearchSuggestion {
  id: string;
  text: string;
  type: 'recent' | 'popular' | 'autocomplete' | 'saved';
  category?: string;
  count?: number;
}

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: Partial<SearchFilters>;
  createdAt: string;
  lastUsed: string;
  useCount: number;
}

const defaultFilters: SearchFilters = {
  query: '',
  fileTypes: [],
  categories: [],
  tags: [],
  dateRange: { start: null, end: null },
  sizeRange: { min: 0, max: 1000 },
  uploader: [],
  projects: [],
  teams: [],
  lastModified: 'any',
  hasComments: false,
  isStarred: false,
  isShared: false,
  hasPreview: false,
  contentType: 'all',
  sortBy: 'relevance',
  sortOrder: 'desc',
  includeArchived: false,
  includeDeleted: false,
};

const fileTypeOptions = [
  { id: 'image', label: 'Images', icon: Image, color: 'bg-green-100 text-green-700' },
  { id: 'video', label: 'Videos', icon: Video, color: 'bg-purple-100 text-purple-700' },
  { id: 'audio', label: 'Audio', icon: Music, color: 'bg-orange-100 text-orange-700' },
  { id: 'document', label: 'Documents', icon: FileText, color: 'bg-blue-100 text-blue-700' },
  { id: 'archive', label: 'Archives', icon: Archive, color: 'bg-gray-100 text-gray-700' },
  { id: 'code', label: 'Code', icon: Code, color: 'bg-indigo-100 text-indigo-700' },
  { id: 'other', label: 'Other', icon: File, color: 'bg-slate-100 text-slate-700' },
];

const categoryOptions = [
  { id: 'work', label: 'Work', icon: Building },
  { id: 'personal', label: 'Personal', icon: User },
  { id: 'shared', label: 'Shared', icon: Share2 },
  { id: 'favorites', label: 'Favorites', icon: Star },
  { id: 'recent', label: 'Recent', icon: Clock },
];

const lastModifiedOptions = [
  { value: 'any', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Past week' },
  { value: 'month', label: 'Past month' },
  { value: 'year', label: 'Past year' },
];

const sortOptions = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'date', label: 'Date modified' },
  { value: 'name', label: 'Name' },
  { value: 'size', label: 'Size' },
  { value: 'downloads', label: 'Downloads' },
  { value: 'views', label: 'Views' },
];

interface AdvancedSearchProps {
  isOpen?: boolean;
  onClose?: () => void;
  initialQuery?: string;
  initialFilters?: Partial<SearchFilters>;
  placeholder?: string;
  showFilters?: boolean;
  compact?: boolean;
}

export default function AdvancedSearch({
  isOpen = false,
  onClose,
  initialQuery = '',
  initialFilters = {},
  placeholder = 'Search files, projects, teams...',
  showFilters = true,
  compact = false,
}: AdvancedSearchProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [filters, setFilters] = useState<SearchFilters>({
    ...defaultFilters,
    query: initialQuery || searchParams.get('q') || '',
    ...initialFilters,
  });
  
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedResults, setSelectedResults] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);

  // Debounced search query
  const debouncedQuery = useDebounce(filters.query, 300);

  // Search API
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['search', debouncedQuery, filters],
    queryFn: async () => {
      if (!debouncedQuery && Object.keys(filters).every(key => 
        key === 'query' || filters[key as keyof SearchFilters] === defaultFilters[key as keyof SearchFilters]
      )) {
        return { results: [], total: 0, suggestions: [] };
      }

      const params = new URLSearchParams();
      if (debouncedQuery) params.append('q', debouncedQuery);
      if (filters.contentType !== 'all') params.append('type', filters.contentType);
      if (filters.fileTypes.length) params.append('fileTypes', filters.fileTypes.join(','));
      if (filters.categories.length) params.append('categories', filters.categories.join(','));
      if (filters.tags.length) params.append('tags', filters.tags.join(','));
      if (filters.uploader.length) params.append('uploader', filters.uploader.join(','));
      if (filters.projects.length) params.append('projects', filters.projects.join(','));
      if (filters.teams.length) params.append('teams', filters.teams.join(','));
      if (filters.lastModified !== 'any') params.append('lastModified', filters.lastModified);
      if (filters.dateRange.start) params.append('dateStart', filters.dateRange.start.toISOString());
      if (filters.dateRange.end) params.append('dateEnd', filters.dateRange.end.toISOString());
      if (filters.sizeRange.min > 0) params.append('sizeMin', filters.sizeRange.min.toString());
      if (filters.sizeRange.max < 1000) params.append('sizeMax', filters.sizeRange.max.toString());
      if (filters.hasComments) params.append('hasComments', 'true');
      if (filters.isStarred) params.append('isStarred', 'true');
      if (filters.isShared) params.append('isShared', 'true');
      if (filters.hasPreview) params.append('hasPreview', 'true');
      if (filters.includeArchived) params.append('includeArchived', 'true');
      if (filters.includeDeleted) params.append('includeDeleted', 'true');
      params.append('sortBy', filters.sortBy);
      params.append('sortOrder', filters.sortOrder);

      const response = await fetch(`/api/search?${params}`);
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    enabled: !!debouncedQuery || Object.keys(filters).some(key => 
      key !== 'query' && filters[key as keyof SearchFilters] !== defaultFilters[key as keyof SearchFilters]
    ),
  });

  // Search suggestions API
  const { data: suggestions } = useQuery({
    queryKey: ['search-suggestions', filters.query],
    queryFn: async () => {
      if (!filters.query || filters.query.length < 2) return [];
      const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(filters.query)}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!filters.query && filters.query.length >= 2,
  });

  // Load user data for filters
  const { data: userData } = useQuery({
    queryKey: ['/api/users', '/api/projects', '/api/teams'],
    queryFn: async () => {
      const [usersRes, projectsRes, teamsRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/projects'),
        fetch('/api/teams'),
      ]);
      return {
        users: usersRes.ok ? await usersRes.json() : [],
        projects: projectsRes.ok ? await projectsRes.json() : [],
        teams: teamsRes.ok ? await teamsRes.json() : [],
      };
    },
  });

  // Handle search
  const handleSearch = useCallback((searchQuery?: string) => {
    const query = searchQuery ?? filters.query;
    if (!query.trim()) return;

    // Update search history
    setSearchHistory(prev => {
      const updated = [query, ...prev.filter(q => q !== query)].slice(0, 10);
      localStorage.setItem('searchHistory', JSON.stringify(updated));
      return updated;
    });

    // Update URL
    const newParams = new URLSearchParams(searchParams);
    newParams.set('q', query);
    if (filters.contentType !== 'all') {
      newParams.set('type', filters.contentType);
    }
    setSearchParams(newParams);

    setIsSearching(true);
  }, [filters.query, filters.contentType, searchParams, setSearchParams]);

  // Handle filter changes
  const updateFilter = useCallback(<K extends keyof SearchFilters>(
    key: K,
    value: SearchFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // Handle clear filters
  const clearFilters = useCallback(() => {
    setFilters(defaultFilters);
    setSearchParams({});
  }, [setSearchParams]);

  // Handle save search
  const saveSearch = useCallback(async (name: string) => {
    const savedSearch: SavedSearch = {
      id: Date.now().toString(),
      name,
      query: filters.query,
      filters,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      useCount: 1,
    };

    try {
      const response = await fetch('/api/search/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savedSearch),
      });
      
      if (response.ok) {
        setSavedSearches(prev => [savedSearch, ...prev]);
        queryClient.invalidateQueries({ queryKey: ['saved-searches'] });
      }
    } catch (error) {
      console.error('Failed to save search:', error);
    }
  }, [filters, queryClient]);

  // Handle load saved search
  const loadSavedSearch = useCallback((savedSearch: SavedSearch) => {
    setFilters({ ...savedSearch.filters, query: savedSearch.query });
    handleSearch(savedSearch.query);
  }, [handleSearch]);

  // Load search history
  useEffect(() => {
    try {
      const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
      setSearchHistory(history);
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
  }, []);

  // Auto-search on filter changes
  useEffect(() => {
    if (debouncedQuery || Object.keys(filters).some(key => 
      key !== 'query' && filters[key as keyof SearchFilters] !== defaultFilters[key as keyof SearchFilters]
    )) {
      setIsSearching(false);
    }
  }, [debouncedQuery, filters]);

  // Results count
  const resultsCount = searchResults?.total || 0;
  const hasActiveFilters = Object.keys(filters).some(key => 
    key !== 'query' && key !== 'sortBy' && key !== 'sortOrder' && 
    filters[key as keyof SearchFilters] !== defaultFilters[key as keyof SearchFilters]
  );

  // Render search result item
  const renderSearchResult = (result: SearchResult) => {
    const IconComponent = result.type === 'file' ? FileText :
                         result.type === 'project' ? Folder :
                         result.type === 'team' ? Users :
                         result.type === 'user' ? User : File;

    return (
      <div
        key={result.id}
        className={`p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors ${
          selectedResults.includes(result.id) ? 'ring-2 ring-primary bg-primary/5' : ''
        }`}
        onClick={() => navigate(result.path)}
      >
        <div className="flex items-start space-x-3">
          {result.thumbnailUrl ? (
            <img
              src={result.thumbnailUrl}
              alt={result.title}
              className="w-12 h-12 object-cover rounded"
            />
          ) : (
            <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
              <IconComponent className="w-6 h-6 text-gray-600" />
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h3 
                className="font-medium text-gray-900 truncate"
                dangerouslySetInnerHTML={{ 
                  __html: result.highlight?.title || result.title 
                }}
              />
              <div className="flex items-center space-x-1 text-xs text-gray-500">
                <span>{result.relevanceScore}% match</span>
              </div>
            </div>
            
            {result.description && (
              <p 
                className="text-sm text-gray-600 line-clamp-2"
                dangerouslySetInnerHTML={{ 
                  __html: result.highlight?.description || result.description 
                }}
              />
            )}
            
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center space-x-2 text-xs text-gray-500">
                {result.uploader && (
                  <div className="flex items-center space-x-1">
                    <Avatar className="w-4 h-4">
                      <AvatarImage src={result.uploader.avatar} />
                      <AvatarFallback className="text-xs">
                        {result.uploader.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span>{result.uploader.name}</span>
                  </div>
                )}
                <span>•</span>
                <span>{new Date(result.updatedAt).toLocaleDateString()}</span>
                {result.size && (
                  <>
                    <span>•</span>
                    <span>{(result.size / 1024 / 1024).toFixed(1)} MB</span>
                  </>
                )}
              </div>
              
              <div className="flex items-center space-x-1">
                {result.tags.slice(0, 3).map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {result.tags.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{result.tags.length - 3}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const SearchContent = () => (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              value={filters.query}
              onChange={(e) => updateFilter('query', e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={placeholder}
              className="pl-10 pr-10"
            />
            {filters.query && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                onClick={() => updateFilter('query', '')}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
          
          {showFilters && (
            <Sheet open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {Object.keys(filters).filter(key => 
                        key !== 'query' && key !== 'sortBy' && key !== 'sortOrder' &&
                        filters[key as keyof SearchFilters] !== defaultFilters[key as keyof SearchFilters]
                      ).length}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-96">
                <SheetHeader>
                  <SheetTitle>Advanced Filters</SheetTitle>
                  <SheetDescription>
                    Refine your search with advanced filters
                  </SheetDescription>
                </SheetHeader>
                
                <ScrollArea className="h-full mt-6">
                  <div className="space-y-6 pr-4">
                    {/* Content Type */}
                    <div>
                      <Label className="text-sm font-medium">Content Type</Label>
                      <Select
                        value={filters.contentType}
                        onValueChange={(value) => updateFilter('contentType', value as any)}
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Content</SelectItem>
                          <SelectItem value="files">Files</SelectItem>
                          <SelectItem value="projects">Projects</SelectItem>
                          <SelectItem value="teams">Teams</SelectItem>
                          <SelectItem value="users">Users</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* File Types */}
                    <div>
                      <Label className="text-sm font-medium">File Types</Label>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {fileTypeOptions.map((type) => {
                          const IconComponent = type.icon;
                          return (
                            <label
                              key={type.id}
                              className="flex items-center space-x-2 cursor-pointer"
                            >
                              <Checkbox
                                checked={filters.fileTypes.includes(type.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    updateFilter('fileTypes', [...filters.fileTypes, type.id]);
                                  } else {
                                    updateFilter('fileTypes', filters.fileTypes.filter(t => t !== type.id));
                                  }
                                }}
                              />
                              <div className={`w-4 h-4 rounded flex items-center justify-center ${type.color}`}>
                                <IconComponent className="w-3 h-3" />
                              </div>
                              <span className="text-sm">{type.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Date Range */}
                    <div>
                      <Label className="text-sm font-medium">Date Range</Label>
                      <div className="space-y-2 mt-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start">
                              <CalendarIcon className="w-4 h-4 mr-2" />
                              {filters.dateRange.start
                                ? `${filters.dateRange.start.toLocaleDateString()} - ${
                                    filters.dateRange.end?.toLocaleDateString() || 'Present'
                                  }`
                                : 'Select date range'
                              }
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="range"
                              selected={{
                                from: filters.dateRange.start || undefined,
                                to: filters.dateRange.end || undefined,
                              }}
                              onSelect={(range) => {
                                updateFilter('dateRange', {
                                  start: range?.from || null,
                                  end: range?.to || null,
                                });
                              }}
                              numberOfMonths={2}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {/* Size Range */}
                    <div>
                      <Label className="text-sm font-medium">
                        File Size (MB): {filters.sizeRange.min} - {filters.sizeRange.max}
                      </Label>
                      <Slider
                        value={[filters.sizeRange.min, filters.sizeRange.max]}
                        onValueChange={([min, max]) => 
                          updateFilter('sizeRange', { min, max })
                        }
                        max={1000}
                        step={1}
                        className="mt-2"
                      />
                    </div>

                    {/* Additional Filters */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Additional Filters</Label>
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2">
                          <Checkbox
                            checked={filters.hasComments}
                            onCheckedChange={(checked) => updateFilter('hasComments', !!checked)}
                          />
                          <span className="text-sm">Has comments</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <Checkbox
                            checked={filters.isStarred}
                            onCheckedChange={(checked) => updateFilter('isStarred', !!checked)}
                          />
                          <span className="text-sm">Starred items</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <Checkbox
                            checked={filters.isShared}
                            onCheckedChange={(checked) => updateFilter('isShared', !!checked)}
                          />
                          <span className="text-sm">Shared items</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <Checkbox
                            checked={filters.hasPreview}
                            onCheckedChange={(checked) => updateFilter('hasPreview', !!checked)}
                          />
                          <span className="text-sm">Has preview</span>
                        </label>
                      </div>
                    </div>

                    {/* Sort Options */}
                    <div>
                      <Label className="text-sm font-medium">Sort By</Label>
                      <div className="flex space-x-2 mt-2">
                        <Select
                          value={filters.sortBy}
                          onValueChange={(value) => updateFilter('sortBy', value)}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {sortOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => 
                            updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')
                          }
                        >
                          {filters.sortOrder === 'asc' ? (
                            <SortAsc className="w-4 h-4" />
                          ) : (
                            <SortDesc className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    {/* Actions */}
                    <div className="flex space-x-2">
                      <Button onClick={clearFilters} variant="outline" className="flex-1">
                        Clear All
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="flex-1">
                            <Bookmark className="w-4 h-4 mr-2" />
                            Save
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Save Search</DialogTitle>
                            <DialogDescription>
                              Save this search for quick access later
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="search-name">Search Name</Label>
                              <Input
                                id="search-name"
                                placeholder="Enter a name for this search"
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    const target = e.target as HTMLInputElement;
                                    if (target.value.trim()) {
                                      saveSearch(target.value.trim());
                                    }
                                  }
                                }}
                              />
                            </div>
                            <Button
                              onClick={() => {
                                const input = document.getElementById('search-name') as HTMLInputElement;
                                if (input?.value.trim()) {
                                  saveSearch(input.value.trim());
                                }
                              }}
                              className="w-full"
                            >
                              Save Search
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
          )}
        </div>

        {/* Search Stats */}
        {(searchResults || searchLoading) && (
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              {searchLoading ? (
                <span>Searching...</span>
              ) : (
                <span>
                  {resultsCount.toLocaleString()} result{resultsCount !== 1 ? 's' : ''} found
                  {filters.query && <span> for "{filters.query}"</span>}
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Search Suggestions */}
      {suggestions && suggestions.length > 0 && !searchResults && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Suggestions</Label>
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 8).map((suggestion: SearchSuggestion) => (
              <Button
                key={suggestion.id}
                variant="outline"
                size="sm"
                onClick={() => {
                  updateFilter('query', suggestion.text);
                  handleSearch(suggestion.text);
                }}
                className="text-xs"
              >
                {suggestion.type === 'recent' && <History className="w-3 h-3 mr-1" />}
                {suggestion.type === 'popular' && <TrendingUp className="w-3 h-3 mr-1" />}
                {suggestion.type === 'saved' && <Bookmark className="w-3 h-3 mr-1" />}
                {suggestion.text}
                {suggestion.count && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {suggestion.count}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Search Results */}
      {searchResults && (
        <div className="space-y-4">
          {searchResults.results?.length > 0 ? (
            <div className={viewMode === 'grid' 
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
              : 'space-y-4'
            }>
              {searchResults.results.map(renderSearchResult)}
            </div>
          ) : (
            <div className="text-center py-12">
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">No results found</p>
              <p className="text-sm text-gray-400">
                Try adjusting your search terms or filters
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (compact) {
    return <SearchContent />;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Search className="w-5 h-5" />
            <span>Advanced Search</span>
          </DialogTitle>
          <DialogDescription>
            Search across all your files, projects, and teams
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1">
          <SearchContent />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}