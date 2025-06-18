import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Enhanced icon imports
import {
  FileText,
  Table,
  FolderPlus,
  UserPlus,
  Upload,
  Image,
  Video,
  Music,
  Camera,
  Mic,
  Monitor,
  Globe,
  Link,
  Copy,
  Download,
  Share2,
  Star,
  Archive,
  Trash2,
  Edit,
  Eye,
  Settings,
  Search,
  Zap,
  Plus,
  Folder,
  Users,
  Calendar,
  Clock,
  Tag,
  MessageSquare,
  Activity,
  BarChart3,
  Shield,
  Database,
  Cloud,
  HardDrive,
  Keyboard,
  Layers,
  Maximize,
  RefreshCw,
  Home,
  ChevronRight,
  BookOpen,
  Flag,
  Sparkles,
} from 'lucide-react';

// Enhanced interfaces
export interface QuickAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<any>;
  shortcut?: string;
  category: ActionCategory;
  handler: () => void | Promise<void>;
  disabled?: boolean;
  isLoading?: boolean;
  priority: number;
  requiresAuth?: boolean;
  requiresPermission?: string;
  contexts?: ActionContext[];
  color?: string;
}

export type ActionCategory = 
  | 'create' 
  | 'file' 
  | 'navigation' 
  | 'edit' 
  | 'view' 
  | 'share' 
  | 'organize' 
  | 'search' 
  | 'system' 
  | 'collaboration'
  | 'media'
  | 'productivity';

export type ActionContext = 
  | 'global' 
  | 'file-selected' 
  | 'multiple-files-selected' 
  | 'project-view' 
  | 'team-view' 
  | 'admin-view'
  | 'mobile'
  | 'offline';

interface ActionGroup {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  actions: QuickAction[];
  expanded?: boolean;
}

export interface QuickActionsState {
  isOpen: boolean;
  searchQuery: string;
  selectedCategory: ActionCategory | 'all';
  selectedActions: string[];
  recentActions: string[];
  favoriteActions: string[];
  customActions: QuickAction[];
}

export const useQuickActions = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  
  const [state, setState] = useState<QuickActionsState>({
    isOpen: false,
    searchQuery: '',
    selectedCategory: 'all',
    selectedActions: [],
    recentActions: [],
    favoriteActions: [],
    customActions: [],
  });
  
  const [isCreating, setIsCreating] = useState(false);

  // Create mutations
  const createDocumentMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create document');
      return response.json();
    },
    onSuccess: (data) => {
      toast.success('Document created successfully');
      navigate(`/documents/${data.id}`);
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    },
    onError: () => {
      toast.error('Failed to create document');
    },
  });

  // Core action handlers
  const actionHandlers = {
    // Creation actions
    createDocument: () => navigate('/create/document'),
    createSpreadsheet: () => navigate('/create/spreadsheet'),
    createPresentation: () => navigate('/create/presentation'),
    createProject: () => navigate('/create/project'),
    createTeam: () => navigate('/create/team'),
    createFolder: () => navigate('/create/folder'),

    // File actions
    uploadFiles: () => navigate('/upload'),
    importFromUrl: () => toast.info('Import from URL feature coming soon'),
    scanDocument: () => toast.info('Document scanner feature coming soon'),
    recordAudio: () => toast.info('Audio recorder feature coming soon'),
    recordVideo: () => toast.info('Video recorder feature coming soon'),
    takeScreenshot: () => toast.info('Screenshot feature coming soon'),

    // Navigation actions
    goHome: () => navigate('/'),
    goToProjects: () => navigate('/projects'),
    goToFiles: () => navigate('/files'),
    goToTeams: () => navigate('/teams'),
    goToSettings: () => navigate('/settings'),
    goToAnalytics: () => navigate('/analytics'),

    // Search actions
    globalSearch: () => {
      const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement;
      if (searchInput) searchInput.focus();
    },
    searchFiles: () => navigate('/search?type=files'),
    searchProjects: () => navigate('/search?type=projects'),

    // View actions
    toggleSidebar: () => { window.dispatchEvent(new CustomEvent('toggle-sidebar')); },
    toggleTheme: () => { window.dispatchEvent(new CustomEvent('toggle-theme')); },
    toggleFullscreen: () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    },
    refreshPage: () => window.location.reload(),

    // Share actions
    shareCurrentPage: () => {
      if (navigator.share) {
        navigator.share({ title: document.title, url: window.location.href });
      } else {
        navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied to clipboard');
      }
    },
    copyCurrentUrl: () => {
      navigator.clipboard.writeText(window.location.href);
      toast.success('URL copied to clipboard');
    },

    // System actions
    showKeyboardShortcuts: () => toast.info('Keyboard shortcuts: Ctrl+K for quick actions'),
    showHelp: () => navigate('/help'),
    reportBug: () => window.open('https://github.com/your-repo/issues/new', '_blank'),
    sendFeedback: () => toast.info('Feedback modal coming soon'),
  };

  // Define all quick actions
  const quickActions: QuickAction[] = [
    // Create actions
    {
      id: 'create-document',
      label: 'New Document',
      description: 'Create a new text document',
      icon: FileText,
      shortcut: 'Ctrl+N',
      category: 'create',
      handler: actionHandlers.createDocument,
      priority: 1,
      requiresAuth: true,
      contexts: ['global'],
      color: 'text-blue-600 bg-blue-100',
    },
    {
      id: 'create-spreadsheet',
      label: 'New Spreadsheet',
      description: 'Create a new spreadsheet',
      icon: Table,
      shortcut: 'Ctrl+Shift+N',
      category: 'create',
      handler: actionHandlers.createSpreadsheet,
      priority: 2,
      requiresAuth: true,
      contexts: ['global'],
      color: 'text-green-600 bg-green-100',
    },
    {
      id: 'create-project',
      label: 'New Project',
      description: 'Create a new project workspace',
      icon: FolderPlus,
      category: 'create',
      handler: actionHandlers.createProject,
      priority: 4,
      requiresAuth: true,
      contexts: ['global'],
      color: 'text-orange-600 bg-orange-100',
    },
    {
      id: 'create-team',
      label: 'New Team',
      description: 'Create a new team for collaboration',
      icon: UserPlus,
      category: 'create',
      handler: actionHandlers.createTeam,
      priority: 5,
      requiresAuth: true,
      contexts: ['global'],
      color: 'text-pink-600 bg-pink-100',
    },
    {
      id: 'upload-files',
      label: 'Upload Files',
      description: 'Upload files from your device',
      icon: Upload,
      shortcut: 'Ctrl+U',
      category: 'file',
      handler: actionHandlers.uploadFiles,
      priority: 1,
      requiresAuth: true,
      contexts: ['global'],
    },
    {
      id: 'go-home',
      label: 'Go to Home',
      description: 'Navigate to the home dashboard',
      icon: Home,
      shortcut: 'Alt+H',
      category: 'navigation',
      handler: actionHandlers.goHome,
      priority: 1,
      contexts: ['global'],
    },
    {
      id: 'go-projects',
      label: 'Go to Projects',
      description: 'View all your projects',
      icon: FolderPlus,
      shortcut: 'Alt+P',
      category: 'navigation',
      handler: actionHandlers.goToProjects,
      priority: 2,
      requiresAuth: true,
      contexts: ['global'],
    },
    {
      id: 'global-search',
      label: 'Global Search',
      description: 'Search across all content',
      icon: Search,
      shortcut: 'Ctrl+K',
      category: 'search',
      handler: actionHandlers.globalSearch,
      priority: 1,
      contexts: ['global'],
    },
    {
      id: 'toggle-sidebar',
      label: 'Toggle Sidebar',
      description: 'Show or hide the navigation sidebar',
      icon: Layers,
      shortcut: 'Ctrl+B',
      category: 'view',
      handler: actionHandlers.toggleSidebar,
      priority: 1,
      contexts: ['global'],
    },
    {
      id: 'toggle-theme',
      label: 'Toggle Theme',
      description: 'Switch between light and dark mode',
      icon: Sparkles,
      shortcut: 'Ctrl+Shift+T',
      category: 'view',
      handler: actionHandlers.toggleTheme,
      priority: 2,
      contexts: ['global'],
    },
  ];

  // Group actions by category
  const actionGroups: ActionGroup[] = [
    {
      id: 'create',
      label: 'Create',
      icon: Plus,
      actions: quickActions.filter(a => a.category === 'create'),
    },
    {
      id: 'file',
      label: 'Files',
      icon: FileText,
      actions: quickActions.filter(a => a.category === 'file'),
    },
    {
      id: 'navigation',
      label: 'Navigation',
      icon: ChevronRight,
      actions: quickActions.filter(a => a.category === 'navigation'),
    },
    {
      id: 'search',
      label: 'Search',
      icon: Search,
      actions: quickActions.filter(a => a.category === 'search'),
    },
    {
      id: 'view',
      label: 'View',
      icon: Eye,
      actions: quickActions.filter(a => a.category === 'view'),
    },
  ];

  // Filter actions based on context and permissions
  const getAvailableActions = useCallback((context: ActionContext = 'global') => {
    return quickActions.filter(action => {
      if (action.requiresAuth && !isAuthenticated) return false;
      if (action.contexts && !action.contexts.includes(context)) return false;
      return true;
    });
  }, [isAuthenticated]);

  // Execute action and track usage
  const executeAction = useCallback(async (actionId: string) => {
    const action = quickActions.find(a => a.id === actionId);
    if (!action) return;

    try {
      setState(prev => ({
        ...prev,
        recentActions: [actionId, ...prev.recentActions.filter(id => id !== actionId)].slice(0, 10)
      }));

      await action.handler();

      const recentActions = [actionId, ...state.recentActions.filter(id => id !== actionId)].slice(0, 10);
      localStorage.setItem('quickActions.recent', JSON.stringify(recentActions));
    } catch (error) {
      console.error('Failed to execute action:', error);
      toast.error('Action failed to execute');
    }
  }, [quickActions, state.recentActions]);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      const action = quickActions.find(a => {
        if (!a.shortcut) return false;
        
        const keys = a.shortcut.toLowerCase().split('+');
        const matchesModifiers = 
          (keys.includes('ctrl') ? event.ctrlKey : !event.ctrlKey) &&
          (keys.includes('shift') ? event.shiftKey : !event.shiftKey) &&
          (keys.includes('alt') ? event.altKey : !event.altKey);
        
        const key = keys[keys.length - 1];
        const matchesKey = event.key.toLowerCase() === key;
        
        return matchesModifiers && matchesKey;
      });

      if (action) {
        event.preventDefault();
        executeAction(action.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quickActions, executeAction]);

  return {
    // State
    state,
    setState,
    
    // Actions
    quickActions,
    actionGroups,
    
    // Methods
    getAvailableActions,
    executeAction,
    
    // Legacy compatibility
    handleKeyboardShortcut: () => {}, // Deprecated
    isCreating: createDocumentMutation.isPending,
  };
};
