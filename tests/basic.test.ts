import { describe, it, expect } from 'vitest';

describe('Basic Tests', () => {
  it('should pass basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should test string operations', () => {
    const str = 'FileFlowMaster';
    expect(str.toLowerCase()).toBe('fileflowmaster');
    expect(str.length).toBe(14);
  });

  it('should test array operations', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(arr.length).toBe(5);
    expect(arr.filter(n => n > 3)).toEqual([4, 5]);
  });

  it('should test object operations', () => {
    const obj = { name: 'FileFlowMaster', version: '1.0.0' };
    expect(obj.name).toBe('FileFlowMaster');
    expect(Object.keys(obj)).toEqual(['name', 'version']);
  });
});