import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LocalStorageService } from '@/services/LocalStorageService';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock console methods to reduce noise in tests
const consoleMock = {
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn(),
};
Object.defineProperty(global, 'console', {
  value: consoleMock,
  writable: true,
});

describe('LocalStorageService', () => {
  let service: LocalStorageService;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    service = LocalStorageService.getInstance();
  });

  afterEach(() => {
    service.clear();
    vi.clearAllTimers();
  });

  describe('Cache Operations', () => {
    it('sets and gets cache entries', () => {
      const testData = { name: 'test', value: 42 };
      const success = service.set('test-key', testData);

      expect(success).toBe(true);
      expect(service.get('test-key')).toEqual(testData);
    });

    it('returns null for non-existent keys', () => {
      expect(service.get('non-existent')).toBeNull();
    });

    it('handles TTL expiration', () => {
      vi.useFakeTimers();
      
      service.set('test-key', 'test-value', 1000); // 1 second TTL
      expect(service.get('test-key')).toBe('test-value');

      // Fast forward time by 2 seconds
      vi.advanceTimersByTime(2000);
      expect(service.get('test-key')).toBeNull();

      vi.useRealTimers();
    });

    it('deletes cache entries', () => {
      service.set('test-key', 'test-value');
      expect(service.get('test-key')).toBe('test-value');

      const deleted = service.delete('test-key');
      expect(deleted).toBe(true);
      expect(service.get('test-key')).toBeNull();
    });

    it('clears all cache entries', () => {
      service.set('key1', 'value1');
      service.set('key2', 'value2');
      expect(service.get('key1')).toBe('value1');
      expect(service.get('key2')).toBe('value2');

      service.clear();
      expect(service.get('key1')).toBeNull();
      expect(service.get('key2')).toBeNull();
    });

    it('checks if key exists', () => {
      expect(service.has('test-key')).toBe(false);
      
      service.set('test-key', 'test-value');
      expect(service.has('test-key')).toBe(true);
      
      service.delete('test-key');
      expect(service.has('test-key')).toBe(false);
    });

    it('returns cache keys', () => {
      service.set('key1', 'value1');
      service.set('key2', 'value2');

      const keys = service.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toHaveLength(2);
    });

    it('returns cache size', () => {
      expect(service.size()).toBe(0);
      
      service.set('key1', 'value1');
      service.set('key2', 'value2');
      expect(service.size()).toBe(2);
      
      service.delete('key1');
      expect(service.size()).toBe(1);
    });
  });

  describe('Compression', () => {
    it('compresses large data automatically', () => {
      const largeData = 'x'.repeat(15000); // Larger than compression threshold
      const success = service.set('large-key', largeData);
      
      expect(success).toBe(true);
      expect(service.get('large-key')).toBe(largeData);
    });

    it('does not compress small data', () => {
      const smallData = 'small data';
      const success = service.set('small-key', smallData);
      
      expect(success).toBe(true);
      expect(service.get('small-key')).toBe(smallData);
    });
  });

  describe('Settings Management', () => {
    it('updates cache settings', () => {
      const newSettings = {
        maxEntries: 500,
        defaultTTL: 60000,
        enableCleanup: false,
      };

      service.updateCacheSettings(newSettings);
      const settings = service.getCacheSettings();

      expect(settings.maxEntries).toBe(500);
      expect(settings.defaultTTL).toBe(60000);
      expect(settings.enableCleanup).toBe(false);
    });

    it('merges partial settings updates', () => {
      const originalSettings = service.getCacheSettings();
      const partialUpdate = { maxEntries: 750 };

      service.updateCacheSettings(partialUpdate);
      const updatedSettings = service.getCacheSettings();

      expect(updatedSettings.maxEntries).toBe(750);
      expect(updatedSettings.defaultTTL).toBe(originalSettings.defaultTTL);
      expect(updatedSettings.enableCleanup).toBe(originalSettings.enableCleanup);
    });
  });

  describe('Storage Information', () => {
    it('provides storage information', () => {
      service.set('test1', 'value1');
      service.set('test2', 'value2');

      const storageInfo = service.getStorageInfo();

      expect(storageInfo.cache.entryCount).toBe(2);
      expect(storageInfo.cache.size).toBeGreaterThan(0);
      expect(storageInfo.total.used).toBeGreaterThan(0);
      expect(storageInfo.total.available).toBeGreaterThan(0);
      expect(storageInfo.total.usedPercentage).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Optimization', () => {
    it('optimizes storage', async () => {
      // Add some test data
      service.set('test1', 'value1');
      service.set('test2', 'value2');
      service.set('test3', 'x'.repeat(15000)); // Large data for compression

      const result = await service.optimize();

      expect(result.before).toBeDefined();
      expect(result.after).toBeDefined();
      expect(result.improvements).toBeInstanceOf(Array);
    });

    it('provides optimization improvements', async () => {
      vi.useFakeTimers();
      
      // Add expired entries
      service.set('expired1', 'value1', 100);
      service.set('expired2', 'value2', 100);
      service.set('current', 'value3', 10000);

      // Fast forward to expire some entries
      vi.advanceTimersByTime(200);

      const result = await service.optimize();
      expect(result.improvements.length).toBeGreaterThan(0);

      vi.useRealTimers();
    });
  });

  describe('Backup and Restore', () => {
    it('creates backup', async () => {
      service.set('test1', 'value1');
      service.set('test2', { nested: 'object' });

      const backup = await service.createBackup();

      expect(backup.version).toBeDefined();
      expect(backup.timestamp).toBeDefined();
      expect(backup.cache).toBeInstanceOf(Array);
      expect(backup.settings).toBeDefined();
      expect(backup.metrics).toBeDefined();
    });

    it('restores from backup', async () => {
      // Create some initial data
      service.set('original', 'data');

      // Create backup
      const backup = await service.createBackup();

      // Clear and add different data
      service.clear();
      service.set('different', 'data');

      // Restore backup
      const result = await service.restoreFromBackup(backup);

      expect(result.success).toBe(true);
      expect(service.get('original')).toBe('data');
      expect(service.get('different')).toBeNull();
    });

    it('handles invalid backup data', async () => {
      const invalidBackup = { invalid: 'backup' };
      
      const result = await service.restoreFromBackup(invalidBackup);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Event System', () => {
    it('emits cache events', () => {
      const mockListener = vi.fn();
      service.addEventListener('cache-set', mockListener);

      service.set('test-key', 'test-value');

      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'cache-set',
          timestamp: expect.any(Number),
          details: expect.objectContaining({
            key: 'test-key',
          }),
        })
      );
    });

    it('removes event listeners', () => {
      const mockListener = vi.fn();
      service.addEventListener('cache-set', mockListener);
      service.removeEventListener('cache-set', mockListener);

      service.set('test-key', 'test-value');

      expect(mockListener).not.toHaveBeenCalled();
    });

    it('emits cache hit and miss events', () => {
      const hitListener = vi.fn();
      const missListener = vi.fn();

      service.addEventListener('cache-hit', hitListener);
      service.addEventListener('cache-miss', missListener);

      // Should emit miss
      service.get('non-existent');
      expect(missListener).toHaveBeenCalled();

      // Set and get should emit hit
      service.set('test-key', 'test-value');
      service.get('test-key');
      expect(hitListener).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('handles localStorage quota exceeded', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      const success = service.set('test-key', 'test-value');
      expect(success).toBe(false);
    });

    it('handles corrupted cache data', () => {
      localStorageMock.getItem.mockReturnValue('invalid-json');
      
      // Should not throw and should initialize with empty cache
      const newService = LocalStorageService.getInstance();
      expect(newService.size()).toBe(0);
    });

    it('gracefully handles compression failures', () => {
      // Mock btoa to fail
      const originalBtoa = global.btoa;
      global.btoa = vi.fn().mockImplementation(() => {
        throw new Error('Compression failed');
      });

      const success = service.set('test-key', 'x'.repeat(15000));
      expect(success).toBe(true); // Should still succeed with uncompressed data

      global.btoa = originalBtoa;
    });
  });

  describe('Metrics', () => {
    it('tracks storage metrics', () => {
      service.set('test1', 'value1');
      service.set('test2', 'value2');
      service.get('test1'); // Hit
      service.get('test1'); // Hit
      service.get('nonexistent'); // Miss

      const metrics = service.getMetrics();

      expect(metrics.entryCount).toBe(2);
      expect(metrics.totalSize).toBeGreaterThan(0);
      expect(metrics.cacheSize).toBeGreaterThan(0);
    });
  });

  describe('Memory Management', () => {
    it('enforces maximum entries limit', () => {
      // Set a low limit for testing
      service.updateCacheSettings({ maxEntries: 3 });

      // Add more entries than the limit
      service.set('key1', 'value1');
      service.set('key2', 'value2');
      service.set('key3', 'value3');
      service.set('key4', 'value4'); // Should trigger cleanup

      expect(service.size()).toBeLessThanOrEqual(3);
    });

    it('cleans up expired entries automatically', () => {
      vi.useFakeTimers();
      
      service.set('short-lived', 'value', 100);
      service.set('long-lived', 'value', 10000);

      expect(service.size()).toBe(2);

      // Fast forward past first item's TTL
      vi.advanceTimersByTime(200);

      // Cleanup should remove expired items
      service.keys(); // This triggers cleanup

      expect(service.get('short-lived')).toBeNull();
      expect(service.get('long-lived')).toBe('value');

      vi.useRealTimers();
    });
  });
});