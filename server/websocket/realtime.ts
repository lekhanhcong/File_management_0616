import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { verifyToken } from '../middleware/auth';
import { storage } from '../storage';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  teams?: string[];
  projects?: string[];
  rooms?: Set<string>;
}

interface WebSocketMessage {
  type: string;
  payload?: any;
  room?: string;
  targetUserId?: string;
}

interface Room {
  id: string;
  type: 'file' | 'team' | 'project';
  resourceId: string;
  participants: Set<AuthenticatedWebSocket>;
}

export class RealtimeServer {
  private wss: WebSocketServer;
  private rooms: Map<string, Room> = new Map();
  private userConnections: Map<string, Set<AuthenticatedWebSocket>> = new Map();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server, 
      path: '/ws',
      verifyClient: async (info) => {
        try {
          const url = new URL(info.req.url!, `http://${info.req.headers.host}`);
          const token = url.searchParams.get('token');
          
          if (!token) {
            return false;
          }

          // Verify JWT token
          const decoded = await verifyToken(token);
          (info.req as any).user = decoded;
          return true;
        } catch (error) {
          console.error('WebSocket authentication failed:', error);
          return false;
        }
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.wss.on('connection', async (ws: AuthenticatedWebSocket, req) => {
      try {
        const user = (req as any).user;
        ws.userId = user.claims.sub;
        ws.rooms = new Set();

        // Load user's teams and projects
        const userTeams = await storage.getUserTeams(ws.userId);
        const userProjects = await storage.getProjects(ws.userId);
        
        ws.teams = userTeams.teams.map(t => t.id);
        ws.projects = userProjects.map(p => p.id);

        // Add to user connections
        if (!this.userConnections.has(ws.userId)) {
          this.userConnections.set(ws.userId, new Set());
        }
        this.userConnections.get(ws.userId)!.add(ws);

        console.log(`WebSocket connection established for user ${ws.userId}`);

        // Send connection success
        this.sendToClient(ws, {
          type: 'connected',
          payload: {
            userId: ws.userId,
            teams: ws.teams,
            projects: ws.projects,
            timestamp: new Date().toISOString(),
          },
        });

        // Setup message handler
        ws.on('message', (data) => {
          this.handleMessage(ws, data);
        });

        // Setup close handler
        ws.on('close', () => {
          this.handleDisconnection(ws);
        });

        // Setup error handler
        ws.on('error', (error) => {
          console.error(`WebSocket error for user ${ws.userId}:`, error);
        });

        // Send presence update
        this.broadcastPresenceUpdate(ws.userId, 'online');

      } catch (error) {
        console.error('WebSocket connection setup failed:', error);
        ws.close();
      }
    });
  }

  private handleMessage(ws: AuthenticatedWebSocket, data: Buffer) {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'join_room':
          this.handleJoinRoom(ws, message);
          break;
        case 'leave_room':
          this.handleLeaveRoom(ws, message);
          break;
        case 'file_activity':
          this.handleFileActivity(ws, message);
          break;
        case 'collaboration_cursor':
          this.handleCollaborationCursor(ws, message);
          break;
        case 'collaboration_selection':
          this.handleCollaborationSelection(ws, message);
          break;
        case 'typing_indicator':
          this.handleTypingIndicator(ws, message);
          break;
        case 'comment_activity':
          this.handleCommentActivity(ws, message);
          break;
        case 'ping':
          this.sendToClient(ws, { type: 'pong' });
          break;
        default:
          console.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      this.sendToClient(ws, {
        type: 'error',
        payload: { message: 'Invalid message format' },
      });
    }
  }

  private async handleJoinRoom(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    const { room, resourceType, resourceId } = message.payload;
    
    try {
      // Verify access permissions
      const hasAccess = await this.verifyRoomAccess(ws.userId!, resourceType, resourceId);
      if (!hasAccess) {
        this.sendToClient(ws, {
          type: 'room_error',
          payload: { message: 'Access denied to room' },
        });
        return;
      }

      // Create room if it doesn't exist
      if (!this.rooms.has(room)) {
        this.rooms.set(room, {
          id: room,
          type: resourceType,
          resourceId,
          participants: new Set(),
        });
      }

      const roomObj = this.rooms.get(room)!;
      roomObj.participants.add(ws);
      ws.rooms!.add(room);

      // Notify room participants
      this.broadcastToRoom(room, {
        type: 'user_joined_room',
        payload: {
          userId: ws.userId,
          room,
          participantCount: roomObj.participants.size,
        },
      }, ws);

      // Send room state to new participant
      this.sendToClient(ws, {
        type: 'room_joined',
        payload: {
          room,
          participants: Array.from(roomObj.participants).map(p => p.userId),
        },
      });

      console.log(`User ${ws.userId} joined room ${room}`);
    } catch (error) {
      console.error('Error joining room:', error);
      this.sendToClient(ws, {
        type: 'room_error',
        payload: { message: 'Failed to join room' },
      });
    }
  }

  private handleLeaveRoom(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    const { room } = message.payload;
    this.removeFromRoom(ws, room);
  }

  private handleFileActivity(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    const { fileId, activity, metadata } = message.payload;
    
    // Broadcast to file room participants
    const room = `file:${fileId}`;
    this.broadcastToRoom(room, {
      type: 'file_activity',
      payload: {
        fileId,
        activity,
        userId: ws.userId,
        metadata,
        timestamp: new Date().toISOString(),
      },
    }, ws);

    // Store activity in database
    storage.createActivity({
      type: activity,
      userId: ws.userId!,
      resourceType: 'file',
      resourceId: fileId,
      metadata,
    }).catch(error => {
      console.error('Failed to store activity:', error);
    });
  }

  private handleCollaborationCursor(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    const { fileId, position } = message.payload;
    const room = `file:${fileId}`;
    
    this.broadcastToRoom(room, {
      type: 'collaboration_cursor',
      payload: {
        userId: ws.userId,
        fileId,
        position,
        timestamp: new Date().toISOString(),
      },
    }, ws);
  }

  private handleCollaborationSelection(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    const { fileId, selection } = message.payload;
    const room = `file:${fileId}`;
    
    this.broadcastToRoom(room, {
      type: 'collaboration_selection',
      payload: {
        userId: ws.userId,
        fileId,
        selection,
        timestamp: new Date().toISOString(),
      },
    }, ws);
  }

  private handleTypingIndicator(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    const { fileId, isTyping } = message.payload;
    const room = `file:${fileId}`;
    
    this.broadcastToRoom(room, {
      type: 'typing_indicator',
      payload: {
        userId: ws.userId,
        fileId,
        isTyping,
        timestamp: new Date().toISOString(),
      },
    }, ws);
  }

  private handleCommentActivity(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    const { fileId, commentId, activity } = message.payload;
    const room = `file:${fileId}`;
    
    this.broadcastToRoom(room, {
      type: 'comment_activity',
      payload: {
        userId: ws.userId,
        fileId,
        commentId,
        activity,
        timestamp: new Date().toISOString(),
      },
    }, ws);
  }

  private handleDisconnection(ws: AuthenticatedWebSocket) {
    if (!ws.userId) return;

    console.log(`WebSocket disconnection for user ${ws.userId}`);

    // Remove from all rooms
    if (ws.rooms) {
      ws.rooms.forEach(room => {
        this.removeFromRoom(ws, room);
      });
    }

    // Remove from user connections
    const userConnections = this.userConnections.get(ws.userId);
    if (userConnections) {
      userConnections.delete(ws);
      if (userConnections.size === 0) {
        this.userConnections.delete(ws.userId);
        // Broadcast offline status if no more connections
        this.broadcastPresenceUpdate(ws.userId, 'offline');
      }
    }
  }

  private removeFromRoom(ws: AuthenticatedWebSocket, room: string) {
    const roomObj = this.rooms.get(room);
    if (roomObj) {
      roomObj.participants.delete(ws);
      
      if (roomObj.participants.size === 0) {
        // Remove empty room
        this.rooms.delete(room);
      } else {
        // Notify remaining participants
        this.broadcastToRoom(room, {
          type: 'user_left_room',
          payload: {
            userId: ws.userId,
            room,
            participantCount: roomObj.participants.size,
          },
        });
      }
    }

    if (ws.rooms) {
      ws.rooms.delete(room);
    }
  }

  private async verifyRoomAccess(userId: string, resourceType: string, resourceId: string): Promise<boolean> {
    try {
      switch (resourceType) {
        case 'file':
          return await storage.checkFileAccess(resourceId, userId);
        case 'team':
          const teamMembership = await storage.getTeamMembership(resourceId, userId);
          return !!teamMembership;
        case 'project':
          const project = await storage.getProject(resourceId);
          return project?.createdBy === userId; // Simplified check
        default:
          return false;
      }
    } catch (error) {
      console.error('Error verifying room access:', error);
      return false;
    }
  }

  private sendToClient(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private broadcastToRoom(room: string, message: WebSocketMessage, excludeWs?: AuthenticatedWebSocket) {
    const roomObj = this.rooms.get(room);
    if (!roomObj) return;

    roomObj.participants.forEach(ws => {
      if (ws !== excludeWs) {
        this.sendToClient(ws, message);
      }
    });
  }

  private broadcastToUser(userId: string, message: WebSocketMessage) {
    const userConnections = this.userConnections.get(userId);
    if (!userConnections) return;

    userConnections.forEach(ws => {
      this.sendToClient(ws, message);
    });
  }

  private broadcastPresenceUpdate(userId: string, status: 'online' | 'offline') {
    // Broadcast to all connected users who share teams or projects
    this.userConnections.forEach((connections, connectedUserId) => {
      if (connectedUserId !== userId) {
        connections.forEach(ws => {
          this.sendToClient(ws, {
            type: 'presence_update',
            payload: {
              userId,
              status,
              timestamp: new Date().toISOString(),
            },
          });
        });
      }
    });
  }

  // Public methods for external use

  public notifyFileUpdate(fileId: string, activity: string, userId: string, metadata?: any) {
    const room = `file:${fileId}`;
    this.broadcastToRoom(room, {
      type: 'file_updated',
      payload: {
        fileId,
        activity,
        userId,
        metadata,
        timestamp: new Date().toISOString(),
      },
    });
  }

  public notifyTeamUpdate(teamId: string, activity: string, userId: string, metadata?: any) {
    const room = `team:${teamId}`;
    this.broadcastToRoom(room, {
      type: 'team_updated',
      payload: {
        teamId,
        activity,
        userId,
        metadata,
        timestamp: new Date().toISOString(),
      },
    });
  }

  public notifyUser(userId: string, message: WebSocketMessage) {
    this.broadcastToUser(userId, message);
  }

  public getConnectedUsers(): string[] {
    return Array.from(this.userConnections.keys());
  }

  public getRoomParticipants(room: string): string[] {
    const roomObj = this.rooms.get(room);
    if (!roomObj) return [];
    
    return Array.from(roomObj.participants).map(ws => ws.userId!);
  }
}

// Export singleton instance
let realtimeServer: RealtimeServer | null = null;

export function createRealtimeServer(server: Server): RealtimeServer {
  if (!realtimeServer) {
    realtimeServer = new RealtimeServer(server);
  }
  return realtimeServer;
}

export function getRealtimeServer(): RealtimeServer | null {
  return realtimeServer;
}