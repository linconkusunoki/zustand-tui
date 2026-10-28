/**
 * Extracts a meaningful action name from an explicit string or caller stack trace.
 */
export function extractActionName(stack?: string, explicitName?: string): string {
  if (explicitName && explicitName.trim() !== '') {
    return explicitName.trim();
  }

  if (!stack) {
    return 'anonymous';
  }

  const lines = stack.split('\n');

  const internalKeywords = [
    'action-extractor',
    'extractActionName',
    'client.ts',
    'client.js',
    'node:internal',
    'node_modules',
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('at ')) {
      continue;
    }

    const isInternal = internalKeywords.some((kw) => trimmed.includes(kw));
    if (isInternal) {
      continue;
    }

    // Match patterns like:
    // at functionName (...)
    // at async functionName (...)
    // at Object.functionName (...)
    // at Object.functionName [as alias] (...)
    const match = trimmed.match(/^at\s+(?:async\s+)?(?:[^\s(]+\.)?([^\s(\[]+)/);
    if (match && match[1]) {
      const candidate = match[1];
      // Only valid JS function identifiers (prevents matching file paths like /app/file.js:1:1)
      if (
        /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(candidate) &&
        candidate !== 'Object' &&
        candidate !== 'Module' &&
        candidate !== 'anonymous'
      ) {
        return candidate;
      }
    }
  }

  return 'anonymous';
}
