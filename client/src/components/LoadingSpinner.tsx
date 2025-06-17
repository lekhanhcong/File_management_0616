// ENHANCED LOADING COMPONENTS
// Provides consistent loading states across the application

import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
  fullscreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  className = '',
  text,
  fullscreen = false
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const spinner = (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <Loader2 className={`animate-spin text-blue-600 ${sizeClasses[size]}`} />
      {text && (
        <p className="mt-2 text-sm text-gray-600">{text}</p>
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-80 flex items-center justify-center z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
};

// Page Loading Component
export const PageLoading: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <LoadingSpinner size="lg" text={message} />
  </div>
);

// Inline Loading Component
export const InlineLoading: React.FC<{ text?: string }> = ({ text = 'Loading...' }) => (
  <div className="flex items-center justify-center py-8">
    <LoadingSpinner size="md" text={text} />
  </div>
);

// Button Loading Component
interface ButtonLoadingProps {
  loading: boolean;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  [key: string]: any;
}

export const ButtonLoading: React.FC<ButtonLoadingProps> = ({ 
  loading, 
  children, 
  className = '',
  disabled,
  ...props 
}) => (
  <button 
    className={`relative ${className}`} 
    disabled={loading || disabled}
    {...props}
  >
    {loading && (
      <div className="absolute inset-0 flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    )}
    <span className={loading ? 'opacity-0' : 'opacity-100'}>
      {children}
    </span>
  </button>
);

// Skeleton Loading Components
export const SkeletonCard: React.FC = () => (
  <div className="animate-pulse">
    <div className="bg-gray-200 h-48 rounded-lg mb-4"></div>
    <div className="space-y-2">
      <div className="bg-gray-200 h-4 rounded w-3/4"></div>
      <div className="bg-gray-200 h-4 rounded w-1/2"></div>
    </div>
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="animate-pulse">
    <div className="bg-gray-200 h-10 rounded mb-4"></div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="bg-gray-100 h-12 rounded mb-2"></div>
    ))}
  </div>
);

export const SkeletonText: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
  <div className="animate-pulse space-y-2">
    {Array.from({ length: lines }).map((_, i) => (
      <div 
        key={i} 
        className={`bg-gray-200 h-4 rounded ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
      ></div>
    ))}
  </div>
);

export default LoadingSpinner;