import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret';

// Mock global fetch
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

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock WebSocket
global.WebSocket = vi.fn().mockImplementation(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
  readyState: WebSocket.OPEN,
}));

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'mocked-object-url');
global.URL.revokeObjectURL = vi.fn();

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock window.scrollTo
global.scrollTo = vi.fn();

// Mock HTMLElement.scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock File and FileReader for file upload tests
global.File = class MockFile {
  constructor(chunks: any[], filename: string, options: any = {}) {
    this.name = filename;
    this.size = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    this.type = options.type || '';
    this.lastModified = options.lastModified || Date.now();
  }
  name: string;
  size: number;
  type: string;
  lastModified: number;
};

global.FileReader = class MockFileReader {
  result: string | ArrayBuffer | null = null;
  error: any = null;
  readyState = 0;
  onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
  onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
  onloadend: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;

  readAsDataURL(file: Blob) {
    this.readyState = 2;
    this.result = `data:${file.type};base64,dGVzdA==`;
    if (this.onload) {
      this.onload({} as ProgressEvent<FileReader>);
    }
  }

  readAsText(file: Blob) {
    this.readyState = 2;
    this.result = 'test content';
    if (this.onload) {
      this.onload({} as ProgressEvent<FileReader>);
    }
  }

  abort() {
    this.readyState = 2;
  }

  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn();
};

// Mock Blob
global.Blob = class MockBlob {
  constructor(chunks: any[] = [], options: any = {}) {
    this.size = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    this.type = options.type || '';
  }
  size: number;
  type: string;
  
  arrayBuffer(): Promise<ArrayBuffer> {
    return Promise.resolve(new ArrayBuffer(this.size));
  }
  
  text(): Promise<string> {
    return Promise.resolve('test content');
  }
  
  stream(): ReadableStream {
    return new ReadableStream();
  }
  
  slice(): Blob {
    return new Blob();
  }
};

// Mock crypto for generating IDs
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'mock-uuid-' + Math.random().toString(36).substr(2, 9),
    getRandomValues: (arr: any) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
  },
});

// Mock navigator
Object.defineProperty(window, 'navigator', {
  value: {
    ...window.navigator,
    clipboard: {
      writeText: vi.fn(() => Promise.resolve()),
      readText: vi.fn(() => Promise.resolve('mocked clipboard text')),
    },
    share: vi.fn(() => Promise.resolve()),
    permissions: {
      query: vi.fn(() => Promise.resolve({ state: 'granted' })),
    },
    serviceWorker: {
      register: vi.fn(() => Promise.resolve()),
      ready: Promise.resolve({
        unregister: vi.fn(() => Promise.resolve()),
      }),
    },
  },
  writable: true,
});

// Mock console methods for cleaner test output
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

// Set up global test utilities
beforeAll(() => {
  // Global test setup
});

afterEach(() => {
  // Clean up after each test
  cleanup();
  vi.clearAllMocks();
  localStorageMock.clear();
  sessionStorageMock.clear();
});

afterAll(() => {
  // Global test cleanup
  vi.restoreAllMocks();
});

// Helper function to create mock responses
export function createMockResponse(data: any, status = 200, statusText = 'OK') {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    blob: () => Promise.resolve(new Blob([JSON.stringify(data)])),
    headers: new Headers(),
    url: 'http://localhost:3000/mock',
    clone: () => createMockResponse(data, status, statusText),
  } as Response);
}

// Helper function to create mock fetch implementation
export function createMockFetch(responses: Record<string, any>) {
  return vi.fn().mockImplementation((url: string, options?: any) => {
    const method = options?.method || 'GET';
    const key = `${method} ${url}`;
    
    if (responses[key]) {
      return createMockResponse(responses[key]);
    }
    
    // Default response
    return createMockResponse({ error: 'Not found' }, 404);
  });
}

// Helper function to mock timers
export function mockTimers() {
  vi.useFakeTimers();
  return {
    advance: (ms: number) => vi.advanceTimersByTime(ms),
    restore: () => vi.useRealTimers(),
  };
}

// Helper function to wait for async operations
export function waitFor(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test database helpers
export const testDbHelpers = {
  reset: () => {
    // Reset test database state
    vi.clearAllMocks();
  },
  
  seed: (data: any) => {
    // Seed test database with data
    return Promise.resolve(data);
  },
  
  cleanup: () => {
    // Clean up test data
    return Promise.resolve();
  },
};

// Authentication test helpers
export const authTestHelpers = {
  mockUser: {
    id: 'test-user-id',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
  },
  
  mockAdmin: {
    id: 'test-admin-id',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
  },
  
  createMockToken: (payload: any) => {
    return `mock-token-${JSON.stringify(payload)}`;
  },
};

// File upload test helpers
export const fileTestHelpers = {
  createMockFile: (name: string, type: string, size = 1024) => {
    const content = 'x'.repeat(size);
    return new File([content], name, { type });
  },
  
  createMockImageFile: (name = 'test.jpg', size = 2048) => {
    return fileTestHelpers.createMockFile(name, 'image/jpeg', size);
  },
  
  createMockPdfFile: (name = 'test.pdf', size = 4096) => {
    return fileTestHelpers.createMockFile(name, 'application/pdf', size);
  },
};

// WebSocket test helpers
export const wsTestHelpers = {
  createMockWebSocket: () => {
    const listeners: Record<string, Function[]> = {};
    
    return {
      addEventListener: vi.fn((event: string, callback: Function) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(callback);
      }),
      removeEventListener: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      readyState: WebSocket.OPEN,
      
      // Test helpers
      emit: (event: string, data: any) => {
        if (listeners[event]) {
          listeners[event].forEach(callback => callback({ data }));
        }
      },
    };
  },
};

// Performance test helpers
export const performanceTestHelpers = {
  measureRender: async (renderFn: () => void) => {
    const start = performance.now();
    renderFn();
    await waitFor(0); // Wait for render
    const end = performance.now();
    return end - start;
  },
  
  measureAsync: async (asyncFn: () => Promise<void>) => {
    const start = performance.now();
    await asyncFn();
    const end = performance.now();
    return end - start;
  },
};