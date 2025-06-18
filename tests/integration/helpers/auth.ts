import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const TEST_JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
const TEST_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-only';

export interface TestUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface TestTokens {
  accessToken: string;
  refreshToken: string;
}

export function generateTestTokens(user: TestUser): TestTokens {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    permissions: getUserPermissions(user.role),
  };

  const accessToken = jwt.sign(payload, TEST_JWT_SECRET, {
    expiresIn: '1h',
    issuer: 'fileflowmaster-test',
    audience: 'fileflowmaster-users',
  });

  const refreshToken = jwt.sign(
    { userId: user.id, tokenType: 'refresh' },
    TEST_REFRESH_SECRET,
    {
      expiresIn: '7d',
      issuer: 'fileflowmaster-test',
      audience: 'fileflowmaster-users',
    }
  );

  return { accessToken, refreshToken };
}

export function verifyTestToken(token: string): any {
  try {
    return jwt.verify(token, TEST_JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid test token');
  }
}

export function verifyTestRefreshToken(token: string): any {
  try {
    return jwt.verify(token, TEST_REFRESH_SECRET);
  } catch (error) {
    throw new Error('Invalid test refresh token');
  }
}

export async function hashTestPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function compareTestPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function getUserPermissions(role: string): string[] {
  const permissions: Record<string, string[]> = {
    admin: [
      'files:read',
      'files:write',
      'files:delete',
      'files:share',
      'projects:read',
      'projects:write',
      'projects:delete',
      'teams:read',
      'teams:write',
      'teams:delete',
      'users:read',
      'users:write',
      'users:delete',
      'system:admin',
    ],
    manager: [
      'files:read',
      'files:write',
      'files:delete',
      'files:share',
      'projects:read',
      'projects:write',
      'projects:delete',
      'teams:read',
      'teams:write',
      'users:read',
    ],
    user: [
      'files:read',
      'files:write',
      'files:share',
      'projects:read',
      'projects:write',
      'teams:read',
    ],
    viewer: [
      'files:read',
      'projects:read',
      'teams:read',
    ],
  };

  return permissions[role] || permissions.viewer;
}

export function createTestAuthMiddleware() {
  return (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = verifyTestToken(token);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  };
}

export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
    ...overrides,
  };
}

export function createTestAdmin(overrides: Partial<TestUser> = {}): TestUser {
  return createTestUser({
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    ...overrides,
  });
}

export function createTestManager(overrides: Partial<TestUser> = {}): TestUser {
  return createTestUser({
    email: 'manager@example.com',
    firstName: 'Manager',
    lastName: 'User',
    role: 'manager',
    ...overrides,
  });
}

export function createTestViewer(overrides: Partial<TestUser> = {}): TestUser {
  return createTestUser({
    email: 'viewer@example.com',
    firstName: 'Viewer',
    lastName: 'User',
    role: 'viewer',
    ...overrides,
  });
}

// Auth test helpers
export class AuthTestHelper {
  private static instance: AuthTestHelper;

  static getInstance(): AuthTestHelper {
    if (!AuthTestHelper.instance) {
      AuthTestHelper.instance = new AuthTestHelper();
    }
    return AuthTestHelper.instance;
  }

  createUserWithTokens(role: string = 'user'): { user: TestUser; tokens: TestTokens } {
    const user = createTestUser({ role });
    const tokens = generateTestTokens(user);
    return { user, tokens };
  }

  createExpiredToken(user: TestUser): string {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    // Create token that's already expired
    return jwt.sign(payload, TEST_JWT_SECRET, {
      expiresIn: '-1h', // Expired 1 hour ago
      issuer: 'fileflowmaster-test',
    });
  }

  createInvalidToken(): string {
    return jwt.sign({ userId: 'test' }, 'wrong-secret');
  }

  createMalformedToken(): string {
    return 'not.a.jwt.token';
  }

  validatePermission(userRole: string, requiredPermission: string): boolean {
    const userPermissions = getUserPermissions(userRole);
    return userPermissions.includes(requiredPermission);
  }

  async simulateLogin(email: string, password: string): Promise<{ user: TestUser; tokens: TestTokens } | null> {
    // Simulate user lookup (in real tests, this would query the database)
    const mockUsers: Record<string, { password: string; user: TestUser }> = {
      'test@example.com': {
        password: await hashTestPassword('password123'),
        user: createTestUser({ email: 'test@example.com' }),
      },
      'admin@example.com': {
        password: await hashTestPassword('admin123'),
        user: createTestAdmin({ email: 'admin@example.com' }),
      },
    };

    const userData = mockUsers[email];
    if (!userData) return null;

    const isValidPassword = await compareTestPassword(password, userData.password);
    if (!isValidPassword) return null;

    const tokens = generateTestTokens(userData.user);
    return { user: userData.user, tokens };
  }

  simulateTokenRefresh(refreshToken: string): TestTokens | null {
    try {
      const decoded = verifyTestRefreshToken(refreshToken);
      if (decoded.tokenType !== 'refresh') return null;

      // Create a mock user for the refresh
      const user = createTestUser({ id: decoded.userId });
      return generateTestTokens(user);
    } catch {
      return null;
    }
  }

  createAuthHeaders(token: string): Record<string, string> {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  // Mock permission checks for different scenarios
  mockPermissionScenarios() {
    return {
      adminCanAccessEverything: () => {
        const admin = createTestAdmin();
        const tokens = generateTestTokens(admin);
        return { user: admin, tokens };
      },

      userCanAccessOwnResources: () => {
        const user = createTestUser();
        const tokens = generateTestTokens(user);
        return { user, tokens };
      },

      viewerCanOnlyRead: () => {
        const viewer = createTestViewer();
        const tokens = generateTestTokens(viewer);
        return { user: viewer, tokens };
      },

      unauthenticatedUser: () => {
        return { user: null, tokens: null };
      },

      userWithExpiredToken: () => {
        const user = createTestUser();
        const expiredToken = this.createExpiredToken(user);
        return { user, tokens: { accessToken: expiredToken, refreshToken: '' } };
      },
    };
  }
}

// Export singleton instance
export const authTestHelper = AuthTestHelper.getInstance();

// Rate limiting test helpers
export function createRateLimitTestScenarios() {
  return {
    withinLimit: () => ({
      requests: 5,
      timeWindow: 60000, // 1 minute
      expectedStatus: 200,
    }),

    exceedsLimit: () => ({
      requests: 105, // Exceeds typical 100 req/min limit
      timeWindow: 60000,
      expectedStatus: 429,
    }),

    afterCooldown: () => ({
      requests: 5,
      timeWindow: 120000, // 2 minutes - after cooldown
      expectedStatus: 200,
    }),
  };
}

// Session management test helpers
export function createSessionTestHelpers() {
  const activeSessions = new Map<string, { userId: string; createdAt: Date; lastAccess: Date }>();

  return {
    createSession: (userId: string) => {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      activeSessions.set(sessionId, {
        userId,
        createdAt: new Date(),
        lastAccess: new Date(),
      });
      return sessionId;
    },

    getSession: (sessionId: string) => {
      return activeSessions.get(sessionId) || null;
    },

    updateSession: (sessionId: string) => {
      const session = activeSessions.get(sessionId);
      if (session) {
        session.lastAccess = new Date();
      }
    },

    destroySession: (sessionId: string) => {
      return activeSessions.delete(sessionId);
    },

    destroyAllUserSessions: (userId: string) => {
      for (const [sessionId, session] of activeSessions.entries()) {
        if (session.userId === userId) {
          activeSessions.delete(sessionId);
        }
      }
    },

    getActiveSessionCount: (userId: string) => {
      return Array.from(activeSessions.values()).filter(s => s.userId === userId).length;
    },
  };
}