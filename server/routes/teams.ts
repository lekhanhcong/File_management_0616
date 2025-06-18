import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated } from "../replitAuth";

// Team validation schemas
const createTeamSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  organizationId: z.string().uuid().optional(),
  settings: z.object({
    defaultFilePermissions: z.object({
      public: z.boolean().default(false),
      allowDownload: z.boolean().default(true),
      allowShare: z.boolean().default(true),
      allowComment: z.boolean().default(true),
      allowEdit: z.boolean().default(false),
    }),
    allowGuestAccess: z.boolean().default(false),
    maxFileSize: z.number().default(50 * 1024 * 1024), // 50MB
    allowedFileTypes: z.array(z.string()).default([]),
    autoDeleteInactive: z.boolean().default(false),
    inactivityPeriod: z.number().default(90), // days
  }).optional(),
});

const inviteTeamMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member", "viewer"]).default("member"),
});

const updateTeamMemberSchema = z.object({
  role: z.enum(["owner", "admin", "member", "viewer"]),
  permissions: z.object({
    manageMembers: z.boolean().default(false),
    manageFiles: z.boolean().default(false),
    manageProjects: z.boolean().default(false),
    manageSettings: z.boolean().default(false),
    viewAnalytics: z.boolean().default(false),
  }).optional(),
});

export function registerTeamRoutes(app: Express) {
  // Create team
  app.post('/api/teams', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validation = createTeamSchema.parse(req.body);

      const team = await storage.createTeam({
        ...validation,
        createdBy: userId,
      });

      // Add creator as owner
      await storage.addTeamMember({
        teamId: team.id,
        userId,
        role: 'owner',
        permissions: {
          manageMembers: true,
          manageFiles: true,
          manageProjects: true,
          manageSettings: true,
          viewAnalytics: true,
        },
      });

      res.json(team);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid team data", errors: error.errors });
      }
      console.error("Error creating team:", error);
      res.status(500).json({ message: "Failed to create team" });
    }
  });

  // Get user's teams
  app.get('/api/teams', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const {
        page = 1,
        limit = 20,
        search,
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      const result = await storage.getUserTeams(userId, {
        limit: parseInt(limit),
        offset,
        search: search as string,
      });

      res.json({
        teams: result.teams,
        total: result.total,
        page: parseInt(page),
        totalPages: Math.ceil(result.total / parseInt(limit)),
      });
    } catch (error) {
      console.error("Error fetching teams:", error);
      res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  // Get team by ID
  app.get('/api/teams/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const team = await storage.getTeamWithDetails(req.params.id);
      
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }

      // Check if user is member of the team
      const membership = await storage.getTeamMembership(req.params.id, userId);
      if (!membership) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(team);
    } catch (error) {
      console.error("Error fetching team:", error);
      res.status(500).json({ message: "Failed to fetch team" });
    }
  });

  // Update team
  app.put('/api/teams/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Check permissions
      const membership = await storage.getTeamMembership(req.params.id, userId);
      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const { name, description, settings } = req.body;
      const updatedTeam = await storage.updateTeam(req.params.id, {
        name,
        description,
        settings,
      });

      res.json(updatedTeam);
    } catch (error) {
      console.error("Error updating team:", error);
      res.status(500).json({ message: "Failed to update team" });
    }
  });

  // Invite team member
  app.post('/api/teams/:id/invite', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const teamId = req.params.id;
      
      // Check permissions
      const membership = await storage.getTeamMembership(teamId, userId);
      if (!membership || !membership.permissions?.manageMembers) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const validation = inviteTeamMemberSchema.parse(req.body);
      
      // Check if user is already a member
      const existingMember = await storage.getTeamMemberByEmail(teamId, validation.email);
      if (existingMember) {
        return res.status(400).json({ message: "User is already a team member" });
      }

      // Check for existing invitation
      const existingInvitation = await storage.getTeamInvitationByEmail(teamId, validation.email);
      if (existingInvitation && existingInvitation.status === 'pending') {
        return res.status(400).json({ message: "Invitation already sent" });
      }

      const invitation = await storage.createTeamInvitation({
        teamId,
        email: validation.email,
        role: validation.role,
        invitedBy: userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

      // TODO: Send invitation email

      res.json(invitation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid invitation data", errors: error.errors });
      }
      console.error("Error inviting team member:", error);
      res.status(500).json({ message: "Failed to invite team member" });
    }
  });

  // Accept team invitation
  app.post('/api/teams/invitations/:token/accept', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user?.email) {
        return res.status(400).json({ message: "User email required" });
      }

      const invitation = await storage.getTeamInvitationByToken(req.params.token);
      
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      if (invitation.email !== user.email) {
        return res.status(403).json({ message: "Invitation not for this user" });
      }

      if (invitation.status !== 'pending') {
        return res.status(400).json({ message: "Invitation already processed" });
      }

      if (new Date() > invitation.expiresAt) {
        await storage.updateTeamInvitation(invitation.id, { status: 'expired' });
        return res.status(400).json({ message: "Invitation expired" });
      }

      // Add user to team
      const teamMember = await storage.addTeamMember({
        teamId: invitation.teamId,
        userId,
        role: invitation.role,
        invitedBy: invitation.invitedBy,
        permissions: getDefaultPermissions(invitation.role),
      });

      // Update invitation status
      await storage.updateTeamInvitation(invitation.id, { 
        status: 'accepted',
        acceptedAt: new Date(),
      });

      res.json(teamMember);
    } catch (error) {
      console.error("Error accepting invitation:", error);
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });

  // Get team members
  app.get('/api/teams/:id/members', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Check if user is member of the team
      const membership = await storage.getTeamMembership(req.params.id, userId);
      if (!membership) {
        return res.status(403).json({ message: "Access denied" });
      }

      const members = await storage.getTeamMembers(req.params.id);
      res.json(members);
    } catch (error) {
      console.error("Error fetching team members:", error);
      res.status(500).json({ message: "Failed to fetch team members" });
    }
  });

  // Update team member
  app.put('/api/teams/:teamId/members/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user.claims.sub;
      const { teamId, userId: targetUserId } = req.params;
      
      // Check permissions
      const membership = await storage.getTeamMembership(teamId, currentUserId);
      if (!membership || !membership.permissions?.manageMembers) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const validation = updateTeamMemberSchema.parse(req.body);
      
      const updatedMember = await storage.updateTeamMember(teamId, targetUserId, validation);
      
      if (!updatedMember) {
        return res.status(404).json({ message: "Team member not found" });
      }

      res.json(updatedMember);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid member data", errors: error.errors });
      }
      console.error("Error updating team member:", error);
      res.status(500).json({ message: "Failed to update team member" });
    }
  });

  // Remove team member
  app.delete('/api/teams/:teamId/members/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user.claims.sub;
      const { teamId, userId: targetUserId } = req.params;
      
      // Check permissions (can remove self, or have manage members permission)
      if (currentUserId !== targetUserId) {
        const membership = await storage.getTeamMembership(teamId, currentUserId);
        if (!membership || !membership.permissions?.manageMembers) {
          return res.status(403).json({ message: "Insufficient permissions" });
        }
      }

      // Cannot remove team owner
      const targetMember = await storage.getTeamMembership(teamId, targetUserId);
      if (targetMember?.role === 'owner') {
        return res.status(400).json({ message: "Cannot remove team owner" });
      }

      await storage.removeTeamMember(teamId, targetUserId);
      res.json({ message: "Team member removed successfully" });
    } catch (error) {
      console.error("Error removing team member:", error);
      res.status(500).json({ message: "Failed to remove team member" });
    }
  });
}

function getDefaultPermissions(role: string) {
  switch (role) {
    case 'owner':
      return {
        manageMembers: true,
        manageFiles: true,
        manageProjects: true,
        manageSettings: true,
        viewAnalytics: true,
      };
    case 'admin':
      return {
        manageMembers: true,
        manageFiles: true,
        manageProjects: true,
        manageSettings: false,
        viewAnalytics: true,
      };
    case 'member':
      return {
        manageMembers: false,
        manageFiles: true,
        manageProjects: false,
        manageSettings: false,
        viewAnalytics: false,
      };
    case 'viewer':
    default:
      return {
        manageMembers: false,
        manageFiles: false,
        manageProjects: false,
        manageSettings: false,
        viewAnalytics: false,
      };
  }
}