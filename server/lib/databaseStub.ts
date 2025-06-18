// Temporary stub methods for DatabaseStorage interface
// These should be implemented properly in the actual storage class

export const databaseStubMethods = {
  // Team methods
  createTeam: async (data: any) => ({ id: 'stub-team-id', ...data }),
  addTeamMember: async (teamId: string, userId: string, role: string) => ({ teamId, userId, role }),
  getUserTeams: async (userId: string) => [],
  getTeamWithDetails: async (teamId: string) => null,
  getTeamMembership: async (teamId: string, userId: string) => null,
  updateTeam: async (teamId: string, data: any) => ({ id: teamId, ...data }),
  getTeamMemberByEmail: async (teamId: string, email: string) => null,
  getTeamInvitationByEmail: async (teamId: string, email: string) => null,
  createTeamInvitation: async (data: any) => ({ id: 'stub-invitation-id', ...data }),
  getTeamInvitationByToken: async (token: string) => null,
  updateTeamInvitation: async (invitationId: string, data: any) => ({ id: invitationId, ...data }),
  getTeamMembers: async (teamId: string) => [],
  updateTeamMember: async (teamId: string, userId: string, data: any) => ({ teamId, userId, ...data }),
  removeTeamMember: async (teamId: string, userId: string) => true,

  // Activity methods
  createActivity: async (data: any) => ({ id: 'stub-activity-id', ...data }),

  // File access methods
  checkFileAccess: async (fileId: string, userId: string) => true,
};

export type DatabaseStubMethods = typeof databaseStubMethods;