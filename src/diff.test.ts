import { describe, it, expect } from 'vitest';
import { computeDiff } from './diff.js';

describe('computeDiff', () => {
  it('returns empty array when states are identical', () => {
    const state = { count: 1, user: { name: 'Alice' } };
    expect(computeDiff(state, state)).toEqual([]);
    expect(computeDiff({ count: 1 }, { count: 1 })).toEqual([]);
  });

  it('detects added top-level and nested properties', () => {
    const prev = { count: 1 };
    const next = { count: 1, status: 'ready', settings: { dark: true } };

    const diff = computeDiff(prev, next);
    expect(diff).toEqual([
      { path: 'status', kind: 'added', newValue: 'ready' },
      { path: 'settings.dark', kind: 'added', newValue: true },
    ]);
  });

  it('detects removed properties', () => {
    const prev = { count: 1, temp: 'deleteMe', user: { email: 'a@b.com', active: true } };
    const next = { count: 1, user: { email: 'a@b.com' } };

    const diff = computeDiff(prev, next);
    expect(diff).toEqual([
      { path: 'temp', kind: 'removed', oldValue: 'deleteMe' },
      { path: 'user.active', kind: 'removed', oldValue: true },
    ]);
  });

  it('detects updated property values', () => {
    const prev = { count: 1, user: { name: 'Alice' } };
    const next = { count: 2, user: { name: 'Bob' } };

    const diff = computeDiff(prev, next);
    expect(diff).toEqual([
      { path: 'count', kind: 'updated', oldValue: 1, newValue: 2 },
      { path: 'user.name', kind: 'updated', oldValue: 'Alice', newValue: 'Bob' },
    ]);
  });

  it('treats all properties as added when prev is null or undefined', () => {
    const next = { a: 10, b: 'hello' };
    const diff = computeDiff(undefined, next);

    expect(diff).toEqual([
      { path: 'a', kind: 'added', newValue: 10 },
      { path: 'b', kind: 'added', newValue: 'hello' },
    ]);
  });
});
