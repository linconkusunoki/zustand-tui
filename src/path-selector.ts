export interface PathResolutionSuccess {
  found: true;
  value: unknown;
}

export interface PathResolutionFailure {
  found: false;
  error: string;
}

export type PathResolutionResult = PathResolutionSuccess | PathResolutionFailure;

/**
 * Resolves a dot-delimited or bracketed path selector on an object.
 * e.g. "user.profile.name", "items[0].id", "items.0"
 */
export function resolvePath(target: unknown, path?: string | null): PathResolutionResult {
  if (path === undefined || path === null || path.trim() === '') {
    return { found: true, value: target };
  }

  // Normalize array notation `[0]` to `.0`
  const normalizedPath = path.trim().replace(/\[(\d+)\]/g, '.$1');
  const segments = normalizedPath.split('.').filter(Boolean);

  let current: any = target;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];

    if (current === null || current === undefined || typeof current !== 'object') {
      const traversed = segments.slice(0, i).join('.');
      return {
        found: false,
        error: `Cannot read property "${segment}" from non-object at "${traversed || 'root'}"`,
      };
    }

    if (!(segment in current)) {
      const traversed = segments.slice(0, i + 1).join('.');
      return {
        found: false,
        error: `Property "${segment}" does not exist at "${traversed}"`,
      };
    }

    current = current[segment];
  }

  return { found: true, value: current };
}
