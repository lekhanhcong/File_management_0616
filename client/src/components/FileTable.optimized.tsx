// Optimized FileTable component with performance enhancements
// Based on performance audit recommendations

import React, { memo, useMemo, useCallback, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import { formatDistanceToNow } from 'date-fns';
import type { File, FileWithDetails } from '../../../shared/schema';

// Memoized formatters to avoid recalculation
const formatFileSize = memo((size: number): string => {
  if (size === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(size) / Math.log(k));
  return parseFloat((size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

const formatDate = memo((date: string | Date): string => {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
});

const getMimeTypeIcon = memo((mimeType: string): string => {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎥';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.includes('word')) return '📝';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
  if (mimeType.includes('zip') || mimeType.includes('archive')) return '📦';
  return '📄';
});

// Memoized file row component
const FileRow = memo(({ 
  index, 
  style, 
  data 
}: { 
  index: number; 
  style: React.CSSProperties; 
  data: { files: FileWithDetails[]; onFileAction: (file: FileWithDetails, action: string) => void } 
}) => {
  const file = data.files[index];
  
  const handleAction = useCallback((action: string) => {
    data.onFileAction(file, action);
  }, [file, data.onFileAction]);

  const mimeIcon = useMemo(() => getMimeTypeIcon(file.mimeType), [file.mimeType]);
  const formattedSize = useMemo(() => formatFileSize(file.size), [file.size]);
  const formattedDate = useMemo(() => {
    if (!file.createdAt) return 'Unknown';
    return formatDate(file.createdAt);
  }, [file.createdAt]);

  return (
    <div 
      style={style} 
      className="flex items-center px-4 py-2 border-b hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        <span className="text-2xl" aria-label="File type">
          {mimeIcon}
        </span>
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {file.name}
          </p>
          {file.description && (
            <p className="text-sm text-gray-500 truncate">
              {file.description}
            </p>
          )}
        </div>
      </div>
      
      <div className="hidden md:flex items-center space-x-4 text-sm text-gray-500">
        <span className="w-16 text-right">{formattedSize}</span>
        <span className="w-24 text-right">{formattedDate}</span>
        <span className="w-20 text-right">v{file.version}</span>
      </div>
      
      <div className="flex items-center space-x-2 ml-4">
        <button
          onClick={() => handleAction('download')}
          className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
          aria-label={`Download ${file.name}`}
        >
          ⬇️
        </button>
        <button
          onClick={() => handleAction('share')}
          className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
          aria-label={`Share ${file.name}`}
        >
          🔗
        </button>
        <button
          onClick={() => handleAction('delete')}
          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
          aria-label={`Delete ${file.name}`}
        >
          🗑️
        </button>
      </div>
    </div>
  );
});

FileRow.displayName = 'FileRow';

// Debounced search hook
const useDebounced = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

interface OptimizedFileTableProps {
  files: FileWithDetails[];
  loading?: boolean;
  onFileAction?: (file: FileWithDetails, action: string) => void;
  onSearch?: (query: string) => void;
  onSort?: (field: string, direction: 'asc' | 'desc') => void;
}

const OptimizedFileTable = React.memo(({ 
  files, 
  loading = false, 
  onFileAction = () => {}, 
  onSearch = () => {},
  onSort = () => {}
}: OptimizedFileTableProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Debounce search to avoid excessive API calls
  const debouncedSearch = useDebounced(searchQuery, 300);
  
  React.useEffect(() => {
    onSearch(debouncedSearch);
  }, [debouncedSearch, onSearch]);

  // Memoize filtered and sorted files
  const processedFiles = useMemo(() => {
    let filtered = files;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = files.filter(file => 
        file.name.toLowerCase().includes(query) ||
        file.originalName.toLowerCase().includes(query) ||
        file.description?.toLowerCase().includes(query) ||
        file.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    // Sort files
    return [...filtered].sort((a, b) => {
      let aValue: any = a[sortField as keyof FileWithDetails];
      let bValue: any = b[sortField as keyof FileWithDetails];
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [files, searchQuery, sortField, sortDirection]);

  const handleSort = useCallback((field: string) => {
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortDirection(newDirection);
    onSort(field, newDirection);
  }, [sortField, sortDirection, onSort]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  // Memoize list data to prevent unnecessary re-renders
  const listData = useMemo(() => ({
    files: processedFiles,
    onFileAction
  }), [processedFiles, onFileAction]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading files...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Search and controls */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <input
              type="search"
              placeholder="Search files..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="text-sm text-gray-500">
              {processedFiles.length} file{processedFiles.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-600">Sort by:</label>
            <select
              value={sortField}
              onChange={(e) => handleSort(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="name">Name</option>
              <option value="size">Size</option>
              <option value="createdAt">Date</option>
              <option value="mimeType">Type</option>
            </select>
            <button
              onClick={() => handleSort(sortField)}
              className="p-1 text-gray-600 hover:text-gray-800"
              aria-label="Toggle sort direction"
            >
              {sortDirection === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {/* File list header */}
      <div className="hidden md:flex items-center px-4 py-2 bg-gray-50 border-b text-sm font-medium text-gray-700">
        <div className="flex-1">File</div>
        <div className="w-16 text-right">Size</div>
        <div className="w-24 text-right mr-4">Modified</div>
        <div className="w-20 text-right mr-4">Version</div>
        <div className="w-24 text-right">Actions</div>
      </div>

      {/* Virtualized file list */}
      {processedFiles.length > 0 ? (
        <List
          height={Math.min(processedFiles.length * 60, 400)} // Max height of 400px
          width="100%"
          itemCount={processedFiles.length}
          itemSize={60}
          itemData={listData}
          className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
        >
          {FileRow}
        </List>
      ) : (
        <div className="p-8 text-center text-gray-500">
          {searchQuery ? (
            <>
              <p className="text-lg">No files found matching "{searchQuery}"</p>
              <p className="text-sm mt-2">Try adjusting your search terms</p>
            </>
          ) : (
            <>
              <p className="text-lg">No files uploaded yet</p>
              <p className="text-sm mt-2">Upload your first file to get started</p>
            </>
          )}
        </div>
      )}
    </div>
  );
});

OptimizedFileTable.displayName = 'OptimizedFileTable';

export default OptimizedFileTable;