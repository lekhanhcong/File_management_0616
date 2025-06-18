import { useState, useEffect, useRef, useCallback } from 'react';

interface LazyLoadingOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
  disabled?: boolean;
}

export function useLazyLoading(options: LazyLoadingOptions = {}) {
  const {
    threshold = 0.1,
    rootMargin = '50px',
    triggerOnce = true,
    disabled = false,
  } = options;

  const [isIntersecting, setIsIntersecting] = useState(disabled);
  const [hasTriggered, setHasTriggered] = useState(false);
  const elementRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const setElement = useCallback((element: HTMLElement | null) => {
    elementRef.current = element;
  }, []);

  useEffect(() => {
    if (disabled) {
      setIsIntersecting(true);
      return;
    }

    if (!elementRef.current) return;

    if (triggerOnce && hasTriggered) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        const isVisible = entry.isIntersecting;
        setIsIntersecting(isVisible);
        
        if (isVisible && triggerOnce) {
          setHasTriggered(true);
        }
      },
      {
        threshold,
        rootMargin,
      }
    );

    observerRef.current.observe(elementRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [threshold, rootMargin, triggerOnce, disabled, hasTriggered]);

  return {
    isIntersecting,
    setElement,
    hasTriggered,
  };
}

// Hook for lazy loading with loading states
export function useLazyLoadingWithStates<T>(
  loadFunction: () => Promise<T>,
  options: LazyLoadingOptions = {}
) {
  const { isIntersecting, setElement } = useLazyLoading(options);
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (isIntersecting && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      setIsLoading(true);
      setError(null);

      loadFunction()
        .then(setData)
        .catch(setError)
        .finally(() => setIsLoading(false));
    }
  }, [isIntersecting, loadFunction]);

  return {
    data,
    isLoading,
    error,
    isIntersecting,
    setElement,
    refetch: () => {
      hasLoadedRef.current = false;
      setData(null);
      setError(null);
    },
  };
}

// Hook for infinite scrolling
interface InfiniteScrollOptions {
  threshold?: number;
  rootMargin?: string;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
}

export function useInfiniteScroll(
  fetchNextPage: () => void,
  options: InfiniteScrollOptions = {}
) {
  const {
    threshold = 0.1,
    rootMargin = '100px',
    hasNextPage = true,
    isFetchingNextPage = false,
  } = options;

  const { isIntersecting, setElement } = useLazyLoading({
    threshold,
    rootMargin,
    triggerOnce: false,
  });

  useEffect(() => {
    if (isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [isIntersecting, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return {
    setElement,
    isIntersecting,
  };
}

// Hook for batch lazy loading (useful for image galleries)
export function useBatchLazyLoading(
  items: Array<{ id: string; loadFunction: () => Promise<any> }>,
  batchSize = 5
) {
  const [loadedItems, setLoadedItems] = useState<Map<string, any>>(new Map());
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Map<string, Error>>(new Map());
  const currentBatchRef = useRef(0);

  const loadBatch = useCallback(async () => {
    const startIndex = currentBatchRef.current * batchSize;
    const endIndex = Math.min(startIndex + batchSize, items.length);
    const batch = items.slice(startIndex, endIndex);

    if (batch.length === 0) return;

    const batchIds = batch.map(item => item.id);
    setLoadingItems(prev => {
      const newSet = new Set(prev);
      batchIds.forEach(id => newSet.add(id));
      return newSet;
    });

    const promises = batch.map(async item => {
      try {
        const data = await item.loadFunction();
        setLoadedItems(prev => new Map(prev).set(item.id, data));
        return { id: item.id, success: true };
      } catch (error) {
        setErrors(prev => new Map(prev).set(item.id, error as Error));
        return { id: item.id, success: false };
      }
    });

    await Promise.allSettled(promises);

    setLoadingItems(prev => {
      const newSet = new Set(prev);
      batchIds.forEach(id => newSet.delete(id));
      return newSet;
    });

    currentBatchRef.current++;
  }, [items, batchSize]);

  const { isIntersecting, setElement } = useLazyLoading({
    triggerOnce: false,
  });

  useEffect(() => {
    if (isIntersecting && currentBatchRef.current * batchSize < items.length) {
      loadBatch();
    }
  }, [isIntersecting, loadBatch, items.length]);

  return {
    loadedItems,
    loadingItems,
    errors,
    setElement,
    loadedCount: loadedItems.size,
    totalCount: items.length,
    isComplete: loadedItems.size >= items.length,
  };
}

// Hook for virtual scrolling with lazy loading
interface VirtualScrollOptions {
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
  threshold?: number;
}

export function useVirtualScrolling<T>(
  items: T[],
  options: VirtualScrollOptions
) {
  const {
    itemHeight,
    containerHeight,
    overscan = 5,
    threshold = 0.1,
  } = options;

  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const visibleItemsCount = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    startIndex + visibleItemsCount + 2 * overscan
  );

  const visibleItems = items.slice(startIndex, endIndex + 1);
  const offsetY = startIndex * itemHeight;
  const totalHeight = items.length * itemHeight;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Lazy load visible items
  const { isIntersecting, setElement } = useLazyLoading({
    threshold,
    triggerOnce: false,
  });

  return {
    visibleItems,
    startIndex,
    endIndex,
    offsetY,
    totalHeight,
    containerRef,
    handleScroll,
    setElement,
    isIntersecting,
  };
}

// Hook for progressive loading (useful for large datasets)
export function useProgressiveLoading<T>(
  loadFunction: (page: number, pageSize: number) => Promise<T[]>,
  pageSize = 20
) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const currentPageRef = useRef(0);

  const loadNextPage = useCallback(async () => {
    if (isLoading || !hasNextPage) return;

    setIsLoading(true);
    setError(null);

    try {
      const newData = await loadFunction(currentPageRef.current, pageSize);
      
      if (newData.length < pageSize) {
        setHasNextPage(false);
      }

      setData(prev => [...prev, ...newData]);
      currentPageRef.current++;
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [loadFunction, pageSize, isLoading, hasNextPage]);

  const reset = useCallback(() => {
    setData([]);
    setError(null);
    setHasNextPage(true);
    currentPageRef.current = 0;
  }, []);

  // Auto-load first page
  useEffect(() => {
    if (data.length === 0 && !isLoading && hasNextPage) {
      loadNextPage();
    }
  }, [data.length, isLoading, hasNextPage, loadNextPage]);

  const { setElement } = useInfiniteScroll(loadNextPage, {
    hasNextPage,
    isFetchingNextPage: isLoading,
  });

  return {
    data,
    isLoading,
    error,
    hasNextPage,
    loadNextPage,
    reset,
    setElement,
    currentPage: currentPageRef.current,
    totalItems: data.length,
  };
}

// Hook for content-aware lazy loading (based on content type)
export function useContentAwareLazyLoading<T>(
  items: Array<{ id: string; type: 'image' | 'video' | 'document' | 'other'; loadFunction: () => Promise<T> }>,
  options: { prioritizeImages?: boolean; batchSize?: number } = {}
) {
  const { prioritizeImages = true, batchSize = 3 } = options;
  
  const [loadedItems, setLoadedItems] = useState<Map<string, T>>(new Map());
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Map<string, Error>>(new Map());

  // Sort items by priority (images first if prioritizeImages is true)
  const sortedItems = [...items].sort((a, b) => {
    if (prioritizeImages) {
      if (a.type === 'image' && b.type !== 'image') return -1;
      if (a.type !== 'image' && b.type === 'image') return 1;
    }
    return 0;
  });

  const loadItem = useCallback(async (item: typeof items[0]) => {
    if (loadedItems.has(item.id) || loadingItems.has(item.id)) return;

    setLoadingItems(prev => new Set(prev).add(item.id));

    try {
      const data = await item.loadFunction();
      setLoadedItems(prev => new Map(prev).set(item.id, data));
    } catch (error) {
      setErrors(prev => new Map(prev).set(item.id, error as Error));
    } finally {
      setLoadingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
    }
  }, [loadedItems, loadingItems]);

  const { isIntersecting, setElement } = useLazyLoading();

  useEffect(() => {
    if (isIntersecting) {
      // Load items in batches, prioritizing by type
      const itemsToLoad = sortedItems
        .filter(item => !loadedItems.has(item.id) && !loadingItems.has(item.id))
        .slice(0, batchSize);

      itemsToLoad.forEach(loadItem);
    }
  }, [isIntersecting, sortedItems, loadedItems, loadingItems, batchSize, loadItem]);

  return {
    loadedItems,
    loadingItems,
    errors,
    setElement,
    loadedCount: loadedItems.size,
    totalCount: items.length,
    isComplete: loadedItems.size >= items.length,
  };
}