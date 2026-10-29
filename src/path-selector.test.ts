import { describe, it, expect } from 'vitest';
import { resolvePath } from './path-selector.js';

describe('resolvePath', () => {
  const sampleState = {
    user: {
      id: 42,
      profile: {
        name: 'Alice',
        email: 'alice@example.com',
      },
    },
    items: [
      { id: 'item-1', title: 'Keyboard', price: 99 },
      { id: 'item-2', title: 'Mouse', price: 49 },
    ],
    flags: {
      isEnabled: false,
      count: 0,
    },
  };

  it('returns full target when path is empty, null, or undefined', () => {
    expect(resolvePath(sampleState)).toEqual({ found: true, value: sampleState });
    expect(resolvePath(sampleState, '')).toEqual({ found: true, value: sampleState });
    expect(resolvePath(sampleState, null)).toEqual({ found: true, value: sampleState });
  });

  it('resolves top-level keys', () => {
    expect(resolvePath(sampleState, 'user')).toEqual({
      found: true,
      value: sampleState.user,
    });
  });

  it('resolves nested dot paths', () => {
    expect(resolvePath(sampleState, 'user.profile.name')).toEqual({
      found: true,
      value: 'Alice',
    });
  });

  it('resolves array bracket indices and dot indices', () => {
    expect(resolvePath(sampleState, 'items[0].title')).toEqual({
      found: true,
      value: 'Keyboard',
    });
    expect(resolvePath(sampleState, 'items.1.price')).toEqual({
      found: true,
      value: 49,
    });
  });

  it('resolves falsy values accurately', () => {
    expect(resolvePath(sampleState, 'flags.isEnabled')).toEqual({
      found: true,
      value: false,
    });
    expect(resolvePath(sampleState, 'flags.count')).toEqual({
      found: true,
      value: 0,
    });
  });

  it('returns informative failure when property does not exist', () => {
    const res = resolvePath(sampleState, 'user.nonExistent');
    expect(res.found).toBe(false);
    if (!res.found) {
      expect(res.error).toContain('Property "nonExistent" does not exist at "user.nonExistent"');
    }
  });

  it('returns informative failure when traversing primitive or null values', () => {
    const res = resolvePath(sampleState, 'user.profile.name.invalid');
    expect(res.found).toBe(false);
    if (!res.found) {
      expect(res.error).toContain('Cannot read property "invalid" from non-object');
    }
  });
});
