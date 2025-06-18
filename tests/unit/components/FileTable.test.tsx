import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import FileTable from '@/components/FileTable';
import { useAuth } from '@/hooks/useAuth';

// Mock the hooks
vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    isConnected: true,
    sendMessage: vi.fn(),
    lastMessage: null,
  }),
}));

// Mock fetch
global.fetch = vi.fn();

const mockUser = {
  id: 'user-1',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  role: 'user',
};

const mockFiles = [
  {
    id: 'file-1',
    name: 'test-document.pdf',
    type: 'application/pdf',
    size: 1024000,
    uploaderId: 'user-1',
    uploader: { firstName: 'John', lastName: 'Doe' },
    uploadDate: '2024-01-15T10:30:00Z',
    projectId: 'project-1',
    project: { name: 'Test Project' },
    tags: ['important', 'document'],
    isStarred: false,
    downloadCount: 5,
    description: 'Test PDF document',
  },
  {
    id: 'file-2',
    name: 'image.jpg',
    type: 'image/jpeg',
    size: 2048000,
    uploaderId: 'user-2',
    uploader: { firstName: 'Jane', lastName: 'Smith' },
    uploadDate: '2024-01-14T15:45:00Z',
    projectId: 'project-1',
    project: { name: 'Test Project' },
    tags: ['photo'],
    isStarred: true,
    downloadCount: 12,
    description: 'Test image file',
  },
];

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('FileTable', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ files: mockFiles, total: 2 }),
    } as Response);
  });

  it('renders file table with files', async () => {
    render(<FileTable />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
      expect(screen.getByText('image.jpg')).toBeInTheDocument();
    });
  });

  it('displays file information correctly', async () => {
    render(<FileTable />, { wrapper: createWrapper() });

    await waitFor(() => {
      // Check file names
      expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
      expect(screen.getByText('image.jpg')).toBeInTheDocument();

      // Check file sizes
      expect(screen.getByText('1.0 MB')).toBeInTheDocument();
      expect(screen.getByText('2.0 MB')).toBeInTheDocument();

      // Check uploaders
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();

      // Check projects
      expect(screen.getAllByText('Test Project')).toHaveLength(2);
    });
  });

  it('handles file selection', async () => {
    render(<FileTable />, { wrapper: createWrapper() });

    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(3); // 2 files + select all
    });

    // Click first file checkbox
    const firstFileCheckbox = screen.getAllByRole('checkbox')[1];
    fireEvent.click(firstFileCheckbox);

    expect(firstFileCheckbox).toBeChecked();
  });

  it('handles select all functionality', async () => {
    render(<FileTable />, { wrapper: createWrapper() });

    await waitFor(() => {
      const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
      fireEvent.click(selectAllCheckbox);

      const fileCheckboxes = screen.getAllByRole('checkbox').slice(1);
      fileCheckboxes.forEach(checkbox => {
        expect(checkbox).toBeChecked();
      });
    });
  });

  it('shows loading state', () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
    
    render(<FileTable />, { wrapper: createWrapper() });
    
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('shows empty state when no files', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ files: [], total: 0 }),
    } as Response);

    render(<FileTable />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('No files found')).toBeInTheDocument();
    });
  });

  it('handles search functionality', async () => {
    render(<FileTable />, { wrapper: createWrapper() });

    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText('Search files...');
      fireEvent.change(searchInput, { target: { value: 'document' } });
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=document')
      );
    });
  });

  it('handles sorting', async () => {
    render(<FileTable />, { wrapper: createWrapper() });

    await waitFor(() => {
      const nameHeader = screen.getByText('Name');
      fireEvent.click(nameHeader);
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('sortBy=name')
      );
    });
  });

  it('handles file actions', async () => {
    render(<FileTable />, { wrapper: createWrapper() });

    await waitFor(() => {
      const actionButtons = screen.getAllByLabelText('File actions');
      fireEvent.click(actionButtons[0]);
    });

    expect(screen.getByText('Download')).toBeInTheDocument();
    expect(screen.getByText('Share')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('displays file tags', async () => {
    render(<FileTable />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('important')).toBeInTheDocument();
      expect(screen.getByText('document')).toBeInTheDocument();
      expect(screen.getByText('photo')).toBeInTheDocument();
    });
  });

  it('shows starred files correctly', async () => {
    render(<FileTable />, { wrapper: createWrapper() });

    await waitFor(() => {
      const starIcons = screen.getAllByTestId('star-icon');
      expect(starIcons).toHaveLength(1); // Only image.jpg is starred
    });
  });

  it('handles pagination', async () => {
    const manyFiles = Array.from({ length: 25 }, (_, i) => ({
      ...mockFiles[0],
      id: `file-${i}`,
      name: `file-${i}.pdf`,
    }));

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ files: manyFiles.slice(0, 20), total: 25 }),
    } as Response);

    render(<FileTable />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Next')).toBeInTheDocument();
    });
  });

  it('handles error state', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

    render(<FileTable />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Failed to load files')).toBeInTheDocument();
    });
  });
});