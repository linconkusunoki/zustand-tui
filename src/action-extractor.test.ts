import { describe, it, expect } from 'vitest';
import { extractActionName } from './action-extractor.js';

describe('extractActionName', () => {
  it('returns explicit name if provided', () => {
    expect(extractActionName(undefined, 'customAction')).toBe('customAction');
    expect(extractActionName('some stack', 'customAction')).toBe('customAction');
  });

  it('extracts function name from standard V8 / Node stack trace', () => {
    const stack = `Error
    at extractActionName (/app/src/action-extractor.js:5:10)
    at set (/app/src/client.js:45:20)
    at addBear (/app/src/stores/bearStore.js:12:5)
    at onClick (/app/src/components/Button.js:3:1)`;

    expect(extractActionName(stack)).toBe('addBear');
  });

  it('extracts method name from Object.method in stack trace', () => {
    const stack = `Error
    at extractActionName (/app/src/action-extractor.js:5:10)
    at set (/app/src/client.js:45:20)
    at Object.updateCustomerDetails (/app/src/stores/customer.js:18:9)`;

    expect(extractActionName(stack)).toBe('updateCustomerDetails');
  });

  it('extracts async function names', () => {
    const stack = `Error
    at extractActionName (/app/src/action-extractor.js:5:10)
    at set (/app/src/client.js:45:20)
    at async fetchProfile (/app/src/stores/auth.js:30:7)`;

    expect(extractActionName(stack)).toBe('fetchProfile');
  });

  it('falls back to "anonymous" when no caller name can be determined', () => {
    const stack = `Error
    at extractActionName (/app/src/action-extractor.js:5:10)
    at set (/app/src/client.js:45:20)
    at /app/src/stores/bearStore.js:12:5`;

    expect(extractActionName(stack)).toBe('anonymous');
    expect(extractActionName('')).toBe('anonymous');
    expect(extractActionName(undefined)).toBe('anonymous');
  });
});
