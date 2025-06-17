import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: (failureCount, error: any) => {
        // Don't retry on 401 or 404
        if (error.message.includes('401') || error.message.includes('404')) {
          return false;
        }
        return failureCount < 3;
      },
    },
  },
});

export async function apiRequest(method: string, url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  if (!res.ok) {
    if (res.status === 401) {
      window.location.href = '/api/login';
      throw new Error('Unauthorized');
    }
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  return res.json();
}
