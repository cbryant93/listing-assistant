import { describe, it, expect } from 'vitest';

describe('Test Setup', () => {
  it('should run basic tests', () => {
    expect(1 + 1).toBe(2);
  });

  it('should validate test environment is working', () => {
    const testObj = { name: 'test', value: 123 };
    expect(testObj).toHaveProperty('name');
    expect(testObj.value).toBe(123);
  });
});
