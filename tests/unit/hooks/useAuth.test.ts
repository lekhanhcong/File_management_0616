import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useAuth } from '@/hooks/useAuth';

// Mock fetch
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

const mockUser = {
  id: 'user-1',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  role: 'user',
  avatar: 'https://example.com/avatar.jpg',
};

const mockTokens = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
};

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with no user when no token exists', () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('loads user from token on mount', async () => {
    localStorageMock.getItem.mockReturnValue('mock-access-token');
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockUser,
    } as Response);

    const { result } = renderHook(() => useAuth());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });

    expect(fetch).toHaveBeenCalledWith('/api/auth/user', {
      headers: {
        Authorization: 'Bearer mock-access-token',
      },
    });
  });

  it('handles login successfully', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        user: mockUser,
        tokens: mockTokens,
      }),
    } as Response);

    const { result } = renderHook(() => useAuth());

    await waitFor(async () => {
      await result.current.login('john@example.com', 'password');
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('accessToken', mockTokens.accessToken);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('refreshToken', mockTokens.refreshToken);
  });

  it('handles login failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Invalid credentials' }),
    } as Response);

    const { result } = renderHook(() => useAuth());

    await expect(
      result.current.login('john@example.com', 'wrong-password')
    ).rejects.toThrow('Invalid credentials');

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('handles logout', async () => {
    // Set up authenticated state
    localStorageMock.getItem.mockReturnValue('mock-access-token');
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    await waitFor(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('accessToken');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('refreshToken');
  });

  it('handles token refresh', async () => {
    localStorageMock.getItem
      .mockReturnValueOnce('expired-access-token')
      .mockReturnValueOnce('valid-refresh-token');

    // First call fails with 401, second call succeeds with new tokens
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      } as Response);

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    expect(fetch).toHaveBeenCalledWith('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'valid-refresh-token' }),
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith('accessToken', 'new-access-token');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('refreshToken', 'new-refresh-token');
  });

  it('handles failed token refresh', async () => {
    localStorageMock.getItem
      .mockReturnValueOnce('expired-access-token')
      .mockReturnValueOnce('invalid-refresh-token');

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('accessToken');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('refreshToken');
  });

  it('handles network errors gracefully', async () => {
    localStorageMock.getItem.mockReturnValue('mock-access-token');
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('updates user profile', async () => {
    // Set up authenticated state
    localStorageMock.getItem.mockReturnValue('mock-access-token');
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockUser,
          firstName: 'Jane',
        }),
      } as Response);

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    await waitFor(async () => {
      await result.current.updateProfile({ firstName: 'Jane' });
    });

    expect(result.current.user?.firstName).toBe('Jane');
  });

  it('validates required fields for login', async () => {
    const { result } = renderHook(() => useAuth());

    await expect(
      result.current.login('', 'password')
    ).rejects.toThrow('Email and password are required');

    await expect(
      result.current.login('john@example.com', '')
    ).rejects.toThrow('Email and password are required');
  });

  it('handles registration', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        user: mockUser,
        tokens: mockTokens,
      }),
    } as Response);

    const { result } = renderHook(() => useAuth());

    await waitFor(async () => {
      await result.current.register({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'password123',
      });
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
    expect(fetch).toHaveBeenCalledWith('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'password123',
      }),
    });
  });

  it('handles password reset request', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Reset email sent' }),
    } as Response);

    const { result } = renderHook(() => useAuth());

    await waitFor(async () => {
      await result.current.requestPasswordReset('john@example.com');
    });

    expect(fetch).toHaveBeenCalledWith('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'john@example.com' }),
    });
  });
});