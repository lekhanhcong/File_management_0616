import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocket } from '@/hooks/useWebSocket';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  Users,
  UserPlus,
  Settings,
  Crown,
  Shield,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  MessageSquare,
  Activity,
  FileText,
  FolderOpen,
  Calendar,
  Clock,
  Star,
  Share2,
  Bell,
  BellOff,
  Globe,
  Lock,
  ChevronRight,
  Plus,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Info,
  Zap,
  Target,
  BarChart3,
  TrendingUp,
} from 'lucide-react';

interface TeamDashboardProps {
  teamId?: string;
  className?: string;
}

interface Team {
  id: string;
  name: string;
  description?: string;
  slug: string;
  ownerId: string;
  isPublic: boolean;
  memberCount: number;
  projectCount: number;
  fileCount: number;
  createdAt: string;
  settings: {
    defaultFilePermissions: {
      allowDownload: boolean;
      allowShare: boolean;
      allowComment: boolean;
      allowEdit: boolean;
    };
    allowGuestAccess: boolean;
    maxFileSize: number;
    allowedFileTypes: string[];
  };
}

interface TeamMember {
  id: string;
  userId: string;
  teamId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: string;
  isActive: boolean;
  lastSeen?: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
  };
}

interface TeamActivity {
  id: string;
  type: 'member_joined' | 'member_left' | 'file_uploaded' | 'project_created' | 'permissions_changed';
  description: string;
  userId: string;
  user: {
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  timestamp: string;
  metadata?: any;
}

interface TeamInvitation {
  id: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
}

export default function TeamDashboard({ teamId, className }: TeamDashboardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isConnected, sendMessage } = useWebSocket();
  
  const [selectedTab, setSelectedTab] = useState('overview');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  // Fetch team data
  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: [`/api/teams/${teamId}`],
    queryFn: async () => {
      const response = await fetch(`/api/teams/${teamId}`);
      if (!response.ok) throw new Error('Failed to fetch team');
      return response.json();
    },
    enabled: !!teamId,
  });

  // Fetch team members
  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: [`/api/teams/${teamId}/members`],
    queryFn: async () => {
      const response = await fetch(`/api/teams/${teamId}/members`);
      if (!response.ok) throw new Error('Failed to fetch team members');
      return response.json();
    },
    enabled: !!teamId,
  });

  // Fetch team activity
  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: [`/api/teams/${teamId}/activities`],
    queryFn: async () => {
      const response = await fetch(`/api/teams/${teamId}/activities?limit=20`);
      if (!response.ok) throw new Error('Failed to fetch team activities');
      return response.json();
    },
    enabled: !!teamId,
  });

  // Fetch team invitations
  const { data: invitations } = useQuery({
    queryKey: [`/api/teams/${teamId}/invitations`],
    queryFn: async () => {
      const response = await fetch(`/api/teams/${teamId}/invitations`);
      if (!response.ok) throw new Error('Failed to fetch invitations');
      return response.json();
    },
    enabled: !!teamId,
  });

  // Invite member mutation
  const inviteMemberMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const response = await fetch(`/api/teams/${teamId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      if (!response.ok) throw new Error('Failed to send invitation');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/invitations`] });
      setShowInviteDialog(false);
      setInviteEmail('');
      setInviteRole('member');
    },
  });

  // Update member role mutation
  const updateMemberRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
      const response = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) throw new Error('Failed to update member role');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/members`] });
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to remove member');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/teams/${teamId}/members`] });
    },
  });

  // Handle real-time updates
  useEffect(() => {
    if (isConnected && teamId) {
      sendMessage({
        type: 'join_team',
        teamId,
      });

      return () => {
        sendMessage({
          type: 'leave_team',
          teamId,
        });
      };
    }
  }, [isConnected, teamId, sendMessage]);

  const handleInviteMember = () => {
    if (inviteEmail.trim()) {
      inviteMemberMutation.mutate({ email: inviteEmail.trim(), role: inviteRole });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'admin': return <Shield className="w-4 h-4 text-blue-500" />;
      case 'member': return <Users className="w-4 h-4 text-green-500" />;
      case 'viewer': return <Eye className="w-4 h-4 text-gray-500" />;
      default: return <Users className="w-4 h-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner': return 'default';
      case 'admin': return 'secondary';
      case 'member': return 'outline';
      case 'viewer': return 'outline';
      default: return 'outline';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'member_joined': return <UserPlus className="w-4 h-4 text-green-500" />;
      case 'member_left': return <Users className="w-4 h-4 text-red-500" />;
      case 'file_uploaded': return <FileText className="w-4 h-4 text-blue-500" />;
      case 'project_created': return <FolderOpen className="w-4 h-4 text-purple-500" />;
      case 'permissions_changed': return <Settings className="w-4 h-4 text-orange-500" />;
      default: return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const currentUserMember = members?.members?.find((m: TeamMember) => m.userId === user?.id);
  const canManageTeam = currentUserMember?.role === 'owner' || currentUserMember?.role === 'admin';

  if (teamLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Team not found</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold">{team.name}</h1>
            <Badge variant={team.isPublic ? 'default' : 'secondary'}>
              {team.isPublic ? (
                <>
                  <Globe className="w-3 h-3 mr-1" />
                  Public
                </>
              ) : (
                <>
                  <Lock className="w-3 h-3 mr-1" />
                  Private
                </>
              )}
            </Badge>
            {isConnected && (
              <Badge variant="outline" className="text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-1" />
                Live
              </Badge>
            )}
          </div>
          {team.description && (
            <p className="text-gray-600 max-w-2xl">{team.description}</p>
          )}
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <span>{team.memberCount} members</span>
            <span>•</span>
            <span>{team.projectCount} projects</span>
            <span>•</span>
            <span>{team.fileCount} files</span>
            <span>•</span>
            <span>Created {new Date(team.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {canManageTeam && (
            <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                  <DialogDescription>
                    Send an invitation to join {team.name}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="colleague@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <select
                      id="role"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as any)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    >
                      <option value="viewer">Viewer - Can view files and projects</option>
                      <option value="member">Member - Can upload and edit files</option>
                      <option value="admin">Admin - Can manage team and members</option>
                    </select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowInviteDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleInviteMember}
                    disabled={!inviteEmail.trim() || inviteMemberMutation.isPending}
                  >
                    {inviteMemberMutation.isPending ? 'Sending...' : 'Send Invitation'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Team Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Share2 className="w-4 h-4 mr-2" />
                Share Team
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Bell className="w-4 h-4 mr-2" />
                Notification Settings
              </DropdownMenuItem>
              {canManageTeam && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Settings className="w-4 h-4 mr-2" />
                    Team Settings
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Members</CardTitle>
                <Users className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{team.memberCount}</div>
                <p className="text-xs text-muted-foreground">
                  +2 from last month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Projects</CardTitle>
                <FolderOpen className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{team.projectCount}</div>
                <p className="text-xs text-muted-foreground">
                  +1 this week
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Files</CardTitle>
                <FileText className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{team.fileCount}</div>
                <p className="text-xs text-muted-foreground">
                  +15 this week
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="w-5 h-5" />
                <span>Recent Activity</span>
              </CardTitle>
              <CardDescription>Latest updates from your team</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                {activitiesLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  </div>
                ) : activities?.activities?.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No recent activity
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activities?.activities?.map((activity: TeamActivity) => (
                      <div key={activity.id} className="flex items-start space-x-3">
                        <div className="mt-1">
                          {getActivityIcon(activity.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{activity.description}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <Avatar className="w-4 h-4">
                              <AvatarImage src={activity.user.avatar} />
                              <AvatarFallback className="text-xs">
                                {activity.user.firstName[0]}{activity.user.lastName[0]}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-gray-500">
                              {activity.user.firstName} {activity.user.lastName}
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(activity.timestamp).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Team Members ({members?.members?.length || 0})</h3>
            <div className="flex items-center space-x-2">
              <Input
                placeholder="Search members..."
                className="w-64"
              />
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Members List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {membersLoading ? (
              <div className="col-span-full flex items-center justify-center h-32">
                <RefreshCw className="w-5 h-5 animate-spin" />
              </div>
            ) : (
              members?.members?.map((member: TeamMember) => (
                <Card key={member.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarImage src={member.user.avatar} />
                          <AvatarFallback>
                            {member.user.firstName[0]}{member.user.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {member.user.firstName} {member.user.lastName}
                          </p>
                          <p className="text-sm text-gray-500">{member.user.email}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge variant={getRoleBadgeVariant(member.role)} className="text-xs">
                              <div className="mr-1">{getRoleIcon(member.role)}</div>
                              {member.role}
                            </Badge>
                            {member.isActive && (
                              <div className="flex items-center space-x-1">
                                <div className="w-2 h-2 bg-green-500 rounded-full" />
                                <span className="text-xs text-green-600">Online</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {canManageTeam && member.userId !== user?.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Member Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => updateMemberRoleMutation.mutate({
                                memberId: member.id,
                                role: member.role === 'admin' ? 'member' : 'admin'
                              })}
                            >
                              <Shield className="w-4 h-4 mr-2" />
                              {member.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => removeMemberMutation.mutate(member.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Remove from Team
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                    
                    <div className="mt-3 text-xs text-gray-500">
                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                      {member.lastSeen && (
                        <span> • Last seen {new Date(member.lastSeen).toLocaleDateString()}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Pending Invitations */}
          {invitations?.invitations?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Pending Invitations</CardTitle>
                <CardDescription>Members who haven't accepted their invitation yet</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {invitations.invitations.map((invitation: TeamInvitation) => (
                    <div key={invitation.id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <p className="font-medium">{invitation.email}</p>
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <Badge variant="outline" className="text-xs">
                            {invitation.role}
                          </Badge>
                          <span>•</span>
                          <span>Invited {new Date(invitation.createdAt).toLocaleDateString()}</span>
                          <span>•</span>
                          <span className={
                            invitation.status === 'pending' ? 'text-yellow-600' :
                            invitation.status === 'expired' ? 'text-red-600' :
                            'text-gray-600'
                          }>
                            {invitation.status}
                          </span>
                        </div>
                      </div>
                      {canManageTeam && (
                        <Button variant="ghost" size="sm">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Team Activity Feed</CardTitle>
              <CardDescription>Complete history of team activities and changes</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                {activitiesLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activities?.activities?.map((activity: TeamActivity) => (
                      <div key={activity.id} className="flex items-start space-x-4 pb-4 border-b last:border-b-0">
                        <div className="mt-1 p-2 bg-gray-100 rounded-full">
                          {getActivityIcon(activity.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{activity.description}</p>
                          <div className="flex items-center space-x-2 mt-2">
                            <Avatar className="w-6 h-6">
                              <AvatarImage src={activity.user.avatar} />
                              <AvatarFallback className="text-xs">
                                {activity.user.firstName[0]}{activity.user.lastName[0]}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm text-gray-600">
                              {activity.user.firstName} {activity.user.lastName}
                            </span>
                            <span className="text-sm text-gray-400">
                              {new Date(activity.timestamp).toLocaleString()}
                            </span>
                          </div>
                          {activity.metadata && (
                            <pre className="text-xs text-gray-500 mt-2 p-2 bg-gray-50 rounded overflow-x-auto">
                              {JSON.stringify(activity.metadata, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files" className="space-y-6">
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Team files view coming soon</p>
            <p className="text-sm text-gray-400">This will show all files shared within the team</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}