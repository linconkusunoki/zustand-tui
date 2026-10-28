export type DiffKind = 'added' | 'removed' | 'updated';

export interface DiffEntry {
  path: string;
  kind: DiffKind;
  oldValue?: unknown;
  newValue?: unknown;
}

export type StateDiff = DiffEntry[];

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

export function computeDiff(
  prev: unknown,
  next: unknown,
  prefix = ''
): StateDiff {
  const diffs: DiffEntry[] = [];

  if (prev === next) {
    return diffs;
  }

  if (prev === undefined || prev === null) {
    if (isPlainObject(next)) {
      for (const [key, val] of Object.entries(next)) {
        const fullPath = prefix ? `${prefix}.${key}` : key;
        if (isPlainObject(val)) {
          diffs.push(...computeDiff(undefined, val, fullPath));
        } else {
          diffs.push({ path: fullPath, kind: 'added', newValue: val });
        }
      }
    } else if (next !== undefined && next !== null) {
      diffs.push({ path: prefix || 'state', kind: 'added', newValue: next });
    }
    return diffs;
  }

  if (next === undefined || next === null) {
    if (isPlainObject(prev)) {
      for (const [key, val] of Object.entries(prev)) {
        const fullPath = prefix ? `${prefix}.${key}` : key;
        diffs.push({ path: fullPath, kind: 'removed', oldValue: val });
      }
    } else {
      diffs.push({ path: prefix || 'state', kind: 'removed', oldValue: prev });
    }
    return diffs;
  }

  if (isPlainObject(prev) && isPlainObject(next)) {
    const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)]);

    for (const key of allKeys) {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      const prevHas = Object.prototype.hasOwnProperty.call(prev, key);
      const nextHas = Object.prototype.hasOwnProperty.call(next, key);

      if (prevHas && !nextHas) {
        diffs.push({ path: fullPath, kind: 'removed', oldValue: prev[key] });
      } else if (!prevHas && nextHas) {
        if (isPlainObject(next[key])) {
          diffs.push(...computeDiff(undefined, next[key], fullPath));
        } else {
          diffs.push({ path: fullPath, kind: 'added', newValue: next[key] });
        }
      } else {
        const prevVal = prev[key];
        const nextVal = next[key];

        if (isPlainObject(prevVal) && isPlainObject(nextVal)) {
          diffs.push(...computeDiff(prevVal, nextVal, fullPath));
        } else if (JSON.stringify(prevVal) !== JSON.stringify(nextVal)) {
          diffs.push({
            path: fullPath,
            kind: 'updated',
            oldValue: prevVal,
            newValue: nextVal,
          });
        }
      }
    }
  } else if (JSON.stringify(prev) !== JSON.stringify(next)) {
    diffs.push({
      path: prefix || 'state',
      kind: 'updated',
      oldValue: prev,
      newValue: next,
    });
  }

  return diffs;
}
