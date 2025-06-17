import { useState, useCallback } from 'react';
import { FileText, FileSpreadsheet, FolderPlus, Users, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  description: string;
  handler: () => void;
  disabled?: boolean;
}

export const useQuickActions = () => {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);

  // Create new document
  const createDocument = useCallback(async () => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `Untitled Document ${new Date().toLocaleDateString()}`,
          type: 'document',
          content: '',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create document');
      }

      const document = await response.json();
      
      toast({
        title: "Document Created",
        description: `New document "${document.name}" has been created successfully.`,
      });

      // Redirect to document editor
      window.location.href = `/documents/${document.id}`;
    } catch (error) {
      console.error('Error creating document:', error);
      toast({
        title: "Error",
        description: "Failed to create new document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  }, [toast]);

  // Create new spreadsheet
  const createSpreadsheet = useCallback(async () => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/spreadsheets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `Untitled Spreadsheet ${new Date().toLocaleDateString()}`,
          type: 'spreadsheet',
          data: {},
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create spreadsheet');
      }

      const spreadsheet = await response.json();
      
      toast({
        title: "Spreadsheet Created",
        description: `New spreadsheet "${spreadsheet.name}" has been created successfully.`,
      });

      // Redirect to spreadsheet editor
      window.location.href = `/spreadsheets/${spreadsheet.id}`;
    } catch (error) {
      console.error('Error creating spreadsheet:', error);
      toast({
        title: "Error",
        description: "Failed to create new spreadsheet. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  }, [toast]);

  // Create new project
  const createProject = useCallback(async () => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `New Project ${new Date().toLocaleDateString()}`,
          description: '',
          status: 'active',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create project');
      }

      const project = await response.json();
      
      toast({
        title: "Project Created",
        description: `New project "${project.name}" has been created successfully.`,
      });

      // Redirect to project page
      window.location.href = `/projects/${project.id}`;
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: "Error",
        description: "Failed to create new project. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  }, [toast]);

  // Create new team
  const createTeam = useCallback(async () => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `New Team ${new Date().toLocaleDateString()}`,
          description: '',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create team');
      }

      const team = await response.json();
      
      toast({
        title: "Team Created",
        description: `New team "${team.name}" has been created successfully.`,
      });

      // Redirect to team page
      window.location.href = `/teams/${team.id}`;
    } catch (error) {
      console.error('Error creating team:', error);
      toast({
        title: "Error",
        description: "Failed to create new team. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  }, [toast]);

  // Open upload modal
  const openUploadModal = useCallback(() => {
    // Trigger file upload modal
    const event = new CustomEvent('openUploadModal');
    window.dispatchEvent(event);
  }, []);

  const quickActions: QuickAction[] = [
    {
      id: 'new-document',
      label: 'New document',
      icon: FileText,
      shortcut: 'Ctrl+N',
      description: 'Create a new document',
      handler: createDocument,
      disabled: isCreating,
    },
    {
      id: 'new-spreadsheet',
      label: 'New spreadsheet',
      icon: FileSpreadsheet,
      shortcut: 'Ctrl+Shift+N',
      description: 'Create a new spreadsheet',
      handler: createSpreadsheet,
      disabled: isCreating,
    },
    {
      id: 'new-project',
      label: 'New project',
      icon: FolderPlus,
      shortcut: 'Ctrl+Alt+N',
      description: 'Start a new project',
      handler: createProject,
      disabled: isCreating,
    },
    {
      id: 'new-team',
      label: 'New team',
      icon: Users,
      shortcut: 'Ctrl+T',
      description: 'Create a new team',
      handler: createTeam,
      disabled: isCreating,
    },
    {
      id: 'upload-files',
      label: 'Upload Files',
      icon: Upload,
      shortcut: 'Ctrl+U',
      description: 'Upload files to your workspace',
      handler: openUploadModal,
      disabled: false,
    },
  ];

  // Keyboard shortcuts handler
  const handleKeyboardShortcut = useCallback((event: KeyboardEvent) => {
    const { ctrlKey, altKey, shiftKey, key } = event;
    
    if (ctrlKey && !altKey && !shiftKey && key === 'n') {
      event.preventDefault();
      createDocument();
    } else if (ctrlKey && shiftKey && !altKey && key === 'N') {
      event.preventDefault();
      createSpreadsheet();
    } else if (ctrlKey && altKey && !shiftKey && key === 'n') {
      event.preventDefault();
      createProject();
    } else if (ctrlKey && !altKey && !shiftKey && key === 't') {
      event.preventDefault();
      createTeam();
    } else if (ctrlKey && !altKey && !shiftKey && key === 'u') {
      event.preventDefault();
      openUploadModal();
    }
  }, [createDocument, createSpreadsheet, createProject, createTeam, openUploadModal]);

  return {
    quickActions,
    handleKeyboardShortcut,
    isCreating,
  };
};
