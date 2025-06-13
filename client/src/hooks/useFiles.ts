import { useQuery } from "@tanstack/react-query";

export function useFiles(options?: {
  page?: number;
  search?: string;
  projectId?: string;
  mimeTypes?: string;
}) {
  return useQuery({
    queryKey: ['/api/files', options],
    retry: false,
  });
}

export function useRecentFiles() {
  return useQuery({
    queryKey: ['/api/files/recent'],
    retry: false,
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ['/api/projects'],
    retry: false,
  });
}

export function useAuditLogs(options?: {
  page?: number;
  userId?: string;
  resourceType?: string;
  resourceId?: string;
}) {
  return useQuery({
    queryKey: ['/api/audit-logs', options],
    retry: false,
  });
}
