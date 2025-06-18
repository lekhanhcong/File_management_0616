import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocket } from '@/hooks/useWebSocket';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import {
  Users,
  MessageSquare,
  Send,
  Edit,
  Eye,
  EyeOff,
  MoreHorizontal,
  Clock,
  Reply,
  Heart,
  Flag,
  Trash2,
  Pin,
  PinOff,
  Circle,
  Mouse,
  Activity,
  Zap,
  Bell,
  BellOff,
  Share2,
  Copy,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Sparkles,
  MessageCircle,
  Plus,
  Minus,
  X,
  Check,
  Tag,
  ThumbsUp,
  Smile,
  Frown,
  User,
} from 'lucide-react';

interface RealTimeCollaborationProps {
  fileId: string;
  className?: string;
}

interface CollaborationSession {
  id: string;
  fileId: string;
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  status: 'active' | 'idle' | 'offline';
  joinedAt: string;
  lastActivity: string;
  cursor?: {
    x: number;
    y: number;
    line: number;
    column: number;
  };
  selection?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

interface Comment {
  id: string;
  content: string;
  userId: string;
  user: {
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  fileId: string;
  position?: {
    line: number;
    column: number;
  };
  parentId?: string;
  replies: Comment[];
  reactions: {
    type: 'like' | 'love' | 'laugh' | 'dislike';
    userId: string;
    user: {
      firstName: string;
      lastName: string;
    };
  }[];
  isPinned: boolean;
  isResolved: boolean;
  createdAt: string;
  updatedAt: string;
}

interface LiveCursor {
  userId: string;
  user: {
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  position: {
    x: number;
    y: number;
    line: number;
    column: number;
  };
  color: string;
  lastUpdate: number;
}

interface TypingIndicator {
  userId: string;
  user: {
    firstName: string;
    lastName: string;
  };
  isTyping: boolean;
  lastTyped: number;
}

const CURSOR_COLORS = [
  '#3B82F6', // blue
  '#EF4444', // red
  '#10B981', // green
  '#F59E0B', // yellow
  '#8B5CF6', // purple
  '#F97316', // orange
  '#06B6D4', // cyan
  '#EC4899', // pink
];

export default function RealTimeCollaboration({ fileId, className }: RealTimeCollaborationProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isConnected, sendMessage, lastMessage } = useWebSocket();
  
  const [activeSessions, setActiveSessions] = useState<CollaborationSession[]>([]);
  const [liveCursors, setLiveCursors] = useState<Map<string, LiveCursor>>(new Map());
  const [typingIndicators, setTypingIndicators] = useState<Map<string, TypingIndicator>>(new Map());
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<{ line: number; column: number } | null>(null);
  const [showComments, setShowComments] = useState(true);
  const [filterResolved, setFilterResolved] = useState(false);

  const cursorTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const typingTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Fetch collaboration sessions
  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: [`/api/files/${fileId}/collaboration/sessions`],
    queryFn: async () => {
      const response = await fetch(`/api/files/${fileId}/collaboration/sessions`);
      if (!response.ok) throw new Error('Failed to fetch collaboration sessions');
      return response.json();
    },
    enabled: !!fileId,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch comments
  const { data: comments, isLoading: commentsLoading } = useQuery({
    queryKey: [`/api/files/${fileId}/comments`],
    queryFn: async () => {
      const response = await fetch(`/api/files/${fileId}/comments`);
      if (!response.ok) throw new Error('Failed to fetch comments');
      return response.json();
    },
    enabled: !!fileId,
  });

  // Join collaboration session
  const joinSessionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/files/${fileId}/collaborate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join' }),
      });
      if (!response.ok) throw new Error('Failed to join collaboration session');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/files/${fileId}/collaboration/sessions`] });
    },
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async ({ content, position, parentId }: { 
      content: string; 
      position?: { line: number; column: number };
      parentId?: string;
    }) => {
      const response = await fetch(`/api/files/${fileId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, position, parentId }),
      });
      if (!response.ok) throw new Error('Failed to add comment');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/files/${fileId}/comments`] });
      setNewComment('');
      setReplyingTo(null);
      setSelectedPosition(null);
    },
  });

  // React to comment mutation
  const reactToCommentMutation = useMutation({
    mutationFn: async ({ commentId, reaction }: { commentId: string; reaction: string }) => {
      const response = await fetch(`/api/files/${fileId}/comments/${commentId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction }),
      });
      if (!response.ok) throw new Error('Failed to react to comment');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/files/${fileId}/comments`] });
    },
  });

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    try {
      const message = JSON.parse(lastMessage.data);
      
      switch (message.type) {
        case 'collaboration_user_joined':
          setActiveSessions(prev => [...prev, message.session]);
          break;
          
        case 'collaboration_user_left':
          setActiveSessions(prev => prev.filter(s => s.userId !== message.userId));
          setLiveCursors(prev => {
            const updated = new Map(prev);
            updated.delete(message.userId);
            return updated;
          });
          break;
          
        case 'collaboration_cursor_move':
          if (message.userId !== user?.id) {
            const cursor: LiveCursor = {
              userId: message.userId,
              user: message.user,
              position: message.position,
              color: CURSOR_COLORS[message.userId.charCodeAt(0) % CURSOR_COLORS.length],
              lastUpdate: Date.now(),
            };
            
            setLiveCursors(prev => new Map(prev).set(message.userId, cursor));
            
            // Clear existing timeout
            const timeouts = cursorTimeoutRef.current;
            if (timeouts.has(message.userId)) {
              clearTimeout(timeouts.get(message.userId)!);
            }
            
            // Set new timeout to hide cursor after 5 seconds of inactivity
            timeouts.set(message.userId, setTimeout(() => {
              setLiveCursors(prev => {
                const updated = new Map(prev);
                updated.delete(message.userId);
                return updated;
              });
              timeouts.delete(message.userId);
            }, 5000));
          }
          break;
          
        case 'collaboration_typing':
          if (message.userId !== user?.id) {
            const indicator: TypingIndicator = {
              userId: message.userId,
              user: message.user,
              isTyping: message.isTyping,
              lastTyped: Date.now(),
            };
            
            setTypingIndicators(prev => new Map(prev).set(message.userId, indicator));
            
            if (message.isTyping) {
              // Clear existing timeout
              const timeouts = typingTimeoutRef.current;
              if (timeouts.has(message.userId)) {
                clearTimeout(timeouts.get(message.userId)!);
              }
              
              // Set timeout to stop showing typing indicator
              timeouts.set(message.userId, setTimeout(() => {
                setTypingIndicators(prev => {
                  const updated = new Map(prev);
                  const current = updated.get(message.userId);
                  if (current) {
                    updated.set(message.userId, { ...current, isTyping: false });
                  }
                  return updated;
                });
              }, 3000));
            }
          }
          break;
          
        case 'collaboration_comment_added':
          queryClient.invalidateQueries({ queryKey: [`/api/files/${fileId}/comments`] });
          break;
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }, [lastMessage, user?.id, fileId, queryClient]);

  // Join collaboration when component mounts
  useEffect(() => {
    if (isConnected && fileId && user) {
      joinSessionMutation.mutate();
      
      // Join file collaboration room
      sendMessage({
        type: 'join_file_collaboration',
        fileId,
      });
      
      return () => {
        sendMessage({
          type: 'leave_file_collaboration',
          fileId,
        });
      };
    }
  }, [isConnected, fileId, user]);

  // Send cursor position updates
  const handleCursorMove = useCallback((position: { x: number; y: number; line: number; column: number }) => {
    if (isConnected) {
      sendMessage({
        type: 'collaboration_cursor_move',
        fileId,
        position,
      });
    }
  }, [isConnected, fileId, sendMessage]);

  // Send typing indicators
  const handleTyping = useCallback((isTyping: boolean) => {
    if (isConnected) {
      sendMessage({
        type: 'collaboration_typing',
        fileId,
        isTyping,
      });
    }
  }, [isConnected, fileId, sendMessage]);

  const handleAddComment = () => {
    if (newComment.trim()) {
      addCommentMutation.mutate({
        content: newComment.trim(),
        position: selectedPosition || undefined,
        parentId: replyingTo || undefined,
      });
    }
  };

  const handleReactToComment = (commentId: string, reaction: string) => {
    reactToCommentMutation.mutate({ commentId, reaction });
  };

  const getFilteredComments = () => {
    if (!comments?.comments) return [];
    
    let filtered = comments.comments.filter((comment: Comment) => !comment.parentId);
    
    if (filterResolved) {
      filtered = filtered.filter((comment: Comment) => !comment.isResolved);
    }
    
    return filtered;
  };

  const activeSessionsList = sessions?.sessions || activeSessions;
  const collaboratorCount = activeSessionsList.length;
  const onlineCollaborators = activeSessionsList.filter((s: CollaborationSession) => s.status === 'active');

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Collaboration Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <CardTitle>Live Collaboration</CardTitle>
                {isConnected && (
                  <Badge variant="outline" className="text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-1" />
                    Connected
                  </Badge>
                )}
              </div>
              <Badge variant="secondary">
                {collaboratorCount} {collaboratorCount === 1 ? 'collaborator' : 'collaborators'}
              </Badge>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowComments(!showComments)}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Comments ({comments?.comments?.length || 0})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilterResolved(!filterResolved)}
              >
                {filterResolved ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          <CardDescription>
            Collaborate in real-time with your team members
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {/* Active Collaborators */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Label className="text-sm font-medium">Active Collaborators</Label>
              {sessionsLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
            </div>
            
            <div className="flex items-center space-x-2">
              {onlineCollaborators.length === 0 ? (
                <div className="text-sm text-gray-500">
                  No active collaborators
                </div>
              ) : (
                <>
                  <div className="flex -space-x-2">
                    {onlineCollaborators.slice(0, 5).map((session: CollaborationSession) => (
                      <TooltipProvider key={session.id}>
                        <Tooltip>
                          <TooltipTrigger>
                            <Avatar className="w-8 h-8 border-2 border-white">
                              <AvatarImage src={session.user.avatar} />
                              <AvatarFallback className="text-xs">
                                {session.user.firstName[0]}{session.user.lastName[0]}
                              </AvatarFallback>
                            </Avatar>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{session.user.firstName} {session.user.lastName}</p>
                            <p className="text-xs text-gray-400">
                              {session.status} • Joined {new Date(session.joinedAt).toLocaleTimeString()}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                  
                  {onlineCollaborators.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{onlineCollaborators.length - 5} more
                    </Badge>
                  )}
                  
                  {/* Typing Indicators */}
                  {Array.from(typingIndicators.values())
                    .filter(indicator => indicator.isTyping)
                    .map(indicator => (
                      <div key={indicator.userId} className="flex items-center space-x-1 text-xs text-gray-500">
                        <Circle className="w-2 h-2 animate-pulse" />
                        <span>{indicator.user.firstName} is typing...</span>
                      </div>
                    ))}
                </>
              )}
            </div>
          </div>
          
          {/* Live Cursors Display */}
          {liveCursors.size > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Live Cursors</Label>
              <div className="flex flex-wrap gap-2">
                {Array.from(liveCursors.values()).map(cursor => (
                  <div
                    key={cursor.userId}
                    className="flex items-center space-x-2 px-2 py-1 rounded-full text-xs"
                    style={{ backgroundColor: cursor.color + '20', color: cursor.color }}
                  >
                    <Mouse className="w-3 h-3" />
                    <span>{cursor.user.firstName}</span>
                    <span className="text-gray-500">
                      Line {cursor.position.line}, Col {cursor.position.column}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comments Section */}
      {showComments && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-5 h-5" />
                <CardTitle>Comments</CardTitle>
                <Badge variant="outline">{comments?.comments?.length || 0}</Badge>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilterResolved(!filterResolved)}
                >
                  {filterResolved ? 'Show All' : 'Hide Resolved'}
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Add Comment */}
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user?.profileImageUrl || ''} />
                  <AvatarFallback className="text-xs">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Textarea
                    placeholder={
                      replyingTo 
                        ? "Write a reply..." 
                        : selectedPosition 
                          ? `Add a comment at line ${selectedPosition.line}...`
                          : "Add a comment..."
                    }
                    value={newComment}
                    onChange={(e) => {
                      setNewComment(e.target.value);
                      handleTyping(e.target.value.length > 0);
                    }}
                    onBlur={() => handleTyping(false)}
                    className="resize-none"
                    rows={3}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      {selectedPosition && (
                        <Badge variant="outline" className="text-xs">
                          Line {selectedPosition.line}, Col {selectedPosition.column}
                        </Badge>
                      )}
                      {replyingTo && (
                        <Badge variant="outline" className="text-xs">
                          Replying to comment
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {(replyingTo || selectedPosition) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setReplyingTo(null);
                            setSelectedPosition(null);
                            setNewComment('');
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={handleAddComment}
                        disabled={!newComment.trim() || addCommentMutation.isPending}
                      >
                        <Send className="w-3 h-3 mr-1" />
                        {replyingTo ? 'Reply' : 'Comment'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Comments List */}
            <ScrollArea className="h-96">
              {commentsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                </div>
              ) : getFilteredComments().length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>No comments yet</p>
                  <p className="text-sm text-gray-400">Start a conversation with your team</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {getFilteredComments().map((comment: Comment) => (
                    <div key={comment.id} className="space-y-3">
                      {/* Main Comment */}
                      <div className="flex items-start space-x-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={comment.user.avatar} />
                          <AvatarFallback className="text-xs">
                            {comment.user.firstName[0]}{comment.user.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 space-y-2">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <span className="font-medium text-sm">
                                  {comment.user.firstName} {comment.user.lastName}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {new Date(comment.createdAt).toLocaleString()}
                                </span>
                                {comment.position && (
                                  <Badge variant="outline" className="text-xs">
                                    Line {comment.position.line}
                                  </Badge>
                                )}
                                {comment.isPinned && (
                                  <Pin className="w-3 h-3 text-orange-500" />
                                )}
                                {comment.isResolved && (
                                  <CheckCircle className="w-3 h-3 text-green-500" />
                                )}
                              </div>
                              
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="w-3 h-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => setReplyingTo(comment.id)}
                                  >
                                    <Reply className="w-3 h-3 mr-2" />
                                    Reply
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Pin className="w-3 h-3 mr-2" />
                                    {comment.isPinned ? 'Unpin' : 'Pin'}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <CheckCircle className="w-3 h-3 mr-2" />
                                    {comment.isResolved ? 'Unresolve' : 'Resolve'}
                                  </DropdownMenuItem>
                                  {comment.userId === user?.id && (
                                    <DropdownMenuItem className="text-red-600">
                                      <Trash2 className="w-3 h-3 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            
                            <p className="text-sm">{comment.content}</p>
                          </div>
                          
                          {/* Reactions */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1">
                              {['like', 'love', 'laugh', 'dislike'].map(reaction => (
                                <Button
                                  key={reaction}
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2"
                                  onClick={() => handleReactToComment(comment.id, reaction)}
                                >
                                  <span className="text-xs">
                                    {reaction === 'like' && '👍'}
                                    {reaction === 'love' && '❤️'}
                                    {reaction === 'laugh' && '😄'}
                                    {reaction === 'dislike' && '👎'}
                                  </span>
                                  <span className="ml-1 text-xs">
                                    {comment.reactions.filter(r => r.type === reaction).length || ''}
                                  </span>
                                </Button>
                              ))}
                            </div>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setReplyingTo(comment.id)}
                            >
                              <Reply className="w-3 h-3 mr-1" />
                              Reply
                            </Button>
                          </div>
                          
                          {/* Replies */}
                          {comment.replies.length > 0 && (
                            <div className="ml-4 space-y-2 border-l-2 border-gray-200 pl-4">
                              {comment.replies.map((reply: Comment) => (
                                <div key={reply.id} className="flex items-start space-x-2">
                                  <Avatar className="w-6 h-6">
                                    <AvatarImage src={reply.user.avatar} />
                                    <AvatarFallback className="text-xs">
                                      {reply.user.firstName[0]}{reply.user.lastName[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1">
                                    <div className="bg-gray-50 rounded p-2">
                                      <div className="flex items-center space-x-2 mb-1">
                                        <span className="font-medium text-xs">
                                          {reply.user.firstName} {reply.user.lastName}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                          {new Date(reply.createdAt).toLocaleString()}
                                        </span>
                                      </div>
                                      <p className="text-xs">{reply.content}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}