import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Home, 
  FolderOpen, 
  FileText, 
  Plus, 
  Users, 
  BarChart3, 
  Shield, 
  Settings, 
  HelpCircle,
  FolderPlus,
  UserPlus,
  Table,
  ChevronDown,
  ChevronRight,
  Search,
  Bell,
  Star,
  Archive,
  Trash2,
  Download,
  Upload,
  Zap,
  Clock,
  TrendingUp,
  Eye,
  Share2,
  MessageSquare,
  Activity,
  Database,
  Cloud,
  HardDrive,
  Wifi,
  WifiOff
} from "lucide-react";

// Enhanced interfaces
interface SidebarItem {
  id: string;
  icon: React.ComponentType<any>;
  label: string;
  path?: string;
  children?: SidebarItem[];
  badge?: number | string;
  action?: () => void;
  isActive?: boolean;
  disabled?: boolean;
  tooltip?: string;
}

interface SidebarSection {
  id: string;
  title?: string;
  items: SidebarItem[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

interface NotificationItem {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

export default function EnhancedSidebar() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['main', 'create']));
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Fetch user's projects and teams
  const { data: projectsData } = useQuery({
    queryKey: ['/api/projects'],
    queryFn: async () => {
      const response = await fetch('/api/projects');
      if (!response.ok) throw new Error('Failed to fetch projects');
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const { data: teamsData } = useQuery({
    queryKey: ['/api/teams'],
    queryFn: async () => {
      const response = await fetch('/api/teams');
      if (!response.ok) throw new Error('Failed to fetch teams');
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const { data: fileStats } = useQuery({
    queryKey: ['/api/files/stats'],
    queryFn: async () => {
      const response = await fetch('/api/files/stats');
      if (!response.ok) throw new Error('Failed to fetch file stats');
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const { data: notifications } = useQuery({
    queryKey: ['/api/notifications'],
    queryFn: async () => {
      const response = await fetch('/api/notifications?unread=true');
      if (!response.ok) throw new Error('Failed to fetch notifications');
      return response.json();
    },
    enabled: isAuthenticated,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Navigation configuration
  const mainNavigation: SidebarSection = {
    id: 'main',
    items: [
      {
        id: 'home',
        icon: Home,
        label: 'Home',
        path: '/',
        isActive: location.pathname === '/',
        tooltip: 'Go to dashboard home',
      },
      {
        id: 'projects',
        icon: FolderOpen,
        label: 'All projects',
        path: '/projects',
        isActive: location.pathname.startsWith('/projects'),
        badge: projectsData?.total || 0,
        tooltip: 'View all your projects',
      },
      {
        id: 'files',
        icon: FileText,
        label: 'Project files',
        path: '/files',
        isActive: location.pathname.startsWith('/files'),
        badge: fileStats?.total || 0,
        tooltip: 'Browse and manage files',
      },
      {
        id: 'recent',
        icon: Clock,
        label: 'Recent files',
        path: '/files/recent',
        isActive: location.pathname === '/files/recent',
        tooltip: 'Access recently viewed files',
      },
      {
        id: 'starred',
        icon: Star,
        label: 'Starred',
        path: '/files/starred',
        isActive: location.pathname === '/files/starred',
        tooltip: 'View your starred files',
      },
      {
        id: 'shared',
        icon: Share2,
        label: 'Shared with me',
        path: '/files/shared',
        isActive: location.pathname === '/files/shared',
        badge: fileStats?.sharedCount || 0,
        tooltip: 'Files shared with you',
      },
    ],
  };

  const createActions: SidebarSection = {
    id: 'create',
    title: 'Create New',
    items: [
      {
        id: 'new-document',
        icon: FileText,
        label: 'New document',
        action: () => handleCreateItem('document'),
        tooltip: 'Create a new document (Ctrl+N)',
      },
      {
        id: 'new-spreadsheet',
        icon: Table,
        label: 'New spreadsheet',
        action: () => handleCreateItem('spreadsheet'),
        tooltip: 'Create a new spreadsheet (Ctrl+Shift+N)',
      },
      {
        id: 'new-project',
        icon: FolderPlus,
        label: 'New project',
        action: () => handleCreateItem('project'),
        tooltip: 'Create a new project',
      },
      {
        id: 'new-team',
        icon: UserPlus,
        label: 'New team',
        action: () => handleCreateItem('team'),
        tooltip: 'Create a new team',
      },
      {
        id: 'upload-files',
        icon: Upload,
        label: 'Upload files',
        action: () => handleCreateItem('upload'),
        tooltip: 'Upload files from your device',
      },
    ],
  };

  const teamsSection: SidebarSection = {
    id: 'teams',
    title: 'Teams',
    collapsible: true,
    defaultExpanded: true,
    items: (teamsData?.teams || []).map((team: any) => ({
      id: `team-${team.id}`,
      icon: Users,
      label: team.name,
      path: `/teams/${team.id}`,
      isActive: location.pathname.startsWith(`/teams/${team.id}`),
      badge: team.memberCount,
      tooltip: `${team.description || 'Team workspace'}`,
    })),
  };

  const toolsSection: SidebarSection = {
    id: 'tools',
    title: 'Tools & Analytics',
    collapsible: true,
    defaultExpanded: false,
    items: [
      {
        id: 'templates',
        icon: FileText,
        label: 'Templates',
        path: '/templates',
        isActive: location.pathname === '/templates',
        tooltip: 'Browse document templates',
      },
      {
        id: 'dashboards',
        icon: BarChart3,
        label: 'Dashboards',
        path: '/dashboards',
        isActive: location.pathname === '/dashboards',
        tooltip: 'View analytics dashboards',
      },
      {
        id: 'analytics',
        icon: TrendingUp,
        label: 'Analytics',
        path: '/analytics',
        isActive: location.pathname === '/analytics',
        tooltip: 'File and usage analytics',
      },
      {
        id: 'activity',
        icon: Activity,
        label: 'Activity feed',
        path: '/activity',
        isActive: location.pathname === '/activity',
        badge: notifications?.length || 0,
        tooltip: 'View recent activity',
      },
    ],
  };

  const storageSection: SidebarSection = {
    id: 'storage',
    title: 'Storage',
    collapsible: true,
    defaultExpanded: false,
    items: [
      {
        id: 'cloud-storage',
        icon: Cloud,
        label: 'Cloud storage',
        path: '/storage/cloud',
        isActive: location.pathname === '/storage/cloud',
        badge: fileStats?.cloudFiles || 0,
        tooltip: 'Manage cloud storage',
      },
      {
        id: 'local-storage',
        icon: HardDrive,
        label: 'Local storage',
        path: '/storage/local',
        isActive: location.pathname === '/storage/local',
        badge: fileStats?.localFiles || 0,
        tooltip: 'Manage local storage',
      },
      {
        id: 'archived',
        icon: Archive,
        label: 'Archived',
        path: '/files/archived',
        isActive: location.pathname === '/files/archived',
        badge: fileStats?.archivedCount || 0,
        tooltip: 'View archived files',
      },
      {
        id: 'trash',
        icon: Trash2,
        label: 'Trash',
        path: '/files/trash',
        isActive: location.pathname === '/files/trash',
        badge: fileStats?.trashedCount || 0,
        tooltip: 'Manage deleted files',
      },
    ],
  };

  const adminSection: SidebarSection = {
    id: 'admin',
    title: 'Administration',
    collapsible: true,
    defaultExpanded: false,
    items: user?.role === 'admin' ? [
      {
        id: 'user-management',
        icon: Users,
        label: 'User management',
        path: '/admin/users',
        isActive: location.pathname === '/admin/users',
        tooltip: 'Manage users and permissions',
      },
      {
        id: 'access-control',
        icon: Shield,
        label: 'Access control',
        path: '/admin/access',
        isActive: location.pathname === '/admin/access',
        tooltip: 'Manage access permissions',
      },
      {
        id: 'audit-logs',
        icon: Eye,
        label: 'Audit logs',
        path: '/admin/audit',
        isActive: location.pathname === '/admin/audit',
        tooltip: 'View system audit logs',
      },
      {
        id: 'system-settings',
        icon: Database,
        label: 'System settings',
        path: '/admin/settings',
        isActive: location.pathname === '/admin/settings',
        tooltip: 'Configure system settings',
      },
    ] : [],
  };

  // Event handlers
  const handleCreateItem = (type: string) => {
    switch (type) {
      case 'document':
        navigate('/create/document');
        break;
      case 'spreadsheet':
        navigate('/create/spreadsheet');
        break;
      case 'project':
        navigate('/create/project');
        break;
      case 'team':
        navigate('/create/team');
        break;
      case 'upload':
        navigate('/upload');
        break;
      default:
        console.log(`Create ${type}`);
    }
  };

  const handleNavigation = (item: SidebarItem) => {
    if (item.action) {
      item.action();
    } else if (item.path) {
      navigate(item.path);
    }
  };

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const renderSidebarItem = (item: SidebarItem) => (
    <TooltipProvider key={item.id}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={item.isActive ? "default" : "ghost"}
            className={`w-full justify-between group ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            size="sm"
            onClick={() => !item.disabled && handleNavigation(item)}
            disabled={item.disabled}
          >
            <div className="flex items-center">
              <item.icon className="w-4 h-4 mr-3" />
              {!isCollapsed && (
                <>
                  {item.label}
                  {item.badge !== undefined && (
                    <Badge 
                      variant={item.isActive ? "secondary" : "outline"} 
                      className="ml-auto text-xs"
                    >
                      {item.badge}
                    </Badge>
                  )}
                </>
              )}
            </div>
            {!isCollapsed && item.children && (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </Button>
        </TooltipTrigger>
        {(isCollapsed || item.tooltip) && (
          <TooltipContent side="right">
            <p>{item.tooltip || item.label}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );

  const renderSection = (section: SidebarSection) => (
    <div key={section.id} className="space-y-1">
      {section.title && !isCollapsed && (
        <Collapsible
          open={expandedSections.has(section.id)}
          onOpenChange={() => section.collapsible && toggleSection(section.id)}
        >
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider"
              disabled={!section.collapsible}
            >
              {section.title}
              {section.collapsible && (
                <ChevronDown className={`w-3 h-3 transition-transform ${expandedSections.has(section.id) ? 'rotate-180' : ''}`} />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1">
            {section.items.map(renderSidebarItem)}
          </CollapsibleContent>
        </Collapsible>
      )}
      {(!section.title || !section.collapsible || expandedSections.has(section.id)) && (
        <div className="space-y-1">
          {!section.title && section.items.map(renderSidebarItem)}
        </div>
      )}
    </div>
  );

  if (!isAuthenticated) {
    return null;
  }

  return (
    <aside className={`${isCollapsed ? 'w-16' : 'w-64'} bg-white border-r border-gray-200 flex flex-col transition-all duration-300`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">FileFlow</h1>
                <p className="text-xs text-gray-500">Master</p>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${isCollapsed ? 'rotate-90' : '-rotate-90'}`} />
          </Button>
        </div>
      </div>

      {/* User Profile */}
      {!isCollapsed && (
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user?.profileImageUrl} alt={`${user?.firstName} ${user?.lastName}`} />
              <AvatarFallback>
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user?.email}
              </p>
              <div className="flex items-center space-x-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-xs text-gray-500">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
                {notifications?.length > 0 && (
                  <Badge variant="destructive" className="text-xs px-1 py-0">
                    {notifications.length}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <div className="space-y-6">
          {renderSection(mainNavigation)}
          <Separator />
          {renderSection(createActions)}
          <Separator />
          {teamsData?.teams?.length > 0 && (
            <>
              {renderSection(teamsSection)}
              <Separator />
            </>
          )}
          {renderSection(toolsSection)}
          <Separator />
          {renderSection(storageSection)}
          {user?.role === 'admin' && (
            <>
              <Separator />
              {renderSection(adminSection)}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200">
        <div className="space-y-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  className={`w-full ${isCollapsed ? 'justify-center' : 'justify-start'}`}
                  size="sm"
                  onClick={() => navigate('/help')}
                >
                  <HelpCircle className="w-4 h-4 mr-3" />
                  {!isCollapsed && "Support"}
                </Button>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right">
                  <p>Support & Help</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  className={`w-full ${isCollapsed ? 'justify-center' : 'justify-start'}`}
                  size="sm"
                  onClick={() => navigate('/settings')}
                >
                  <Settings className="w-4 h-4 mr-3" />
                  {!isCollapsed && "Settings"}
                </Button>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right">
                  <p>Settings & Preferences</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
        
        {!isCollapsed && (
          <>
            <Separator className="my-3" />
            <div className="flex items-center justify-between px-3">
              <div className="text-xs text-gray-500">FileFlowMaster</div>
              <div className="flex items-center space-x-1">
                <Badge variant="secondary" className="text-xs">
                  v2.0
                </Badge>
                {isOnline ? (
                  <Wifi className="w-3 h-3 text-green-500" />
                ) : (
                  <WifiOff className="w-3 h-3 text-red-500" />
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}