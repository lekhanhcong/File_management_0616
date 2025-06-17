// ENHANCED NOTIFICATION SYSTEM
// Provides toast notifications with queue management and persistence

import { useState, useCallback, createContext, useContext } from 'react';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationState {
  notifications: Notification[];
  add: (notification: Omit<Notification, 'id'>) => void;
  remove: (id: string) => void;
  clear: () => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

export const useNotifications = (): NotificationState => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const generateId = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

  const add = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = generateId();
    const newNotification: Notification = {
      id,
      duration: 5000,
      ...notification
    };

    setNotifications(prev => [...prev, newNotification]);

    // Auto-remove after duration (unless persistent)
    if (!newNotification.persistent && newNotification.duration) {
      setTimeout(() => {
        remove(id);
      }, newNotification.duration);
    }
  }, []);

  const remove = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clear = useCallback(() => {
    setNotifications([]);
  }, []);

  // Convenience methods
  const success = useCallback((title: string, message?: string) => {
    add({ type: 'success', title, message });
  }, [add]);

  const error = useCallback((title: string, message?: string) => {
    add({ type: 'error', title, message, duration: 7000 });
  }, [add]);

  const warning = useCallback((title: string, message?: string) => {
    add({ type: 'warning', title, message, duration: 6000 });
  }, [add]);

  const info = useCallback((title: string, message?: string) => {
    add({ type: 'info', title, message });
  }, [add]);

  return {
    notifications,
    add,
    remove,
    clear,
    success,
    error,
    warning,
    info
  };
};

// Context for notification system - components moved to separate file
const NotificationContext = createContext<NotificationState | undefined>(undefined);

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationProvider');
  }
  return context;
};

export { NotificationContext };