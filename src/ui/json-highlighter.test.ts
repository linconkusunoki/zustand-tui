import { describe, it, expect } from 'vitest';
import { tokenizeJsonLine } from './json-highlighter.js';

describe('tokenizeJsonLine', () => {
  it('tokenizes key-value pair with string value', () => {
    const tokens = tokenizeJsonLine('  "name": "Alice",');
    expect(tokens).toEqual([
      { text: '  ' },
      { text: '"name"', color: 'cyan' },
      { text: ': ', color: 'gray' },
      { text: '"Alice"', color: 'green' },
      { text: ',', color: 'gray' },
    ]);
  });

  it('tokenizes key-value pair with number value', () => {
    const tokens = tokenizeJsonLine('  "count": 42,');
    expect(tokens).toEqual([
      { text: '  ' },
      { text: '"count"', color: 'cyan' },
      { text: ': ', color: 'gray' },
      { text: '42', color: 'yellow' },
      { text: ',', color: 'gray' },
    ]);
  });

  it('tokenizes key-value pair with boolean value', () => {
    const tokens = tokenizeJsonLine('  "active": true');
    expect(tokens).toEqual([
      { text: '  ' },
      { text: '"active"', color: 'cyan' },
      { text: ': ', color: 'gray' },
      { text: 'true', color: 'magenta' },
    ]);
  });

  it('tokenizes key-value pair with null value', () => {
    const tokens = tokenizeJsonLine('  "user": null,');
    expect(tokens).toEqual([
      { text: '  ' },
      { text: '"user"', color: 'cyan' },
      { text: ': ', color: 'gray' },
      { text: 'null', color: 'gray', dimColor: true },
      { text: ',', color: 'gray' },
    ]);
  });

  it('tokenizes structural brackets and braces', () => {
    const tokens1 = tokenizeJsonLine('{');
    expect(tokens1).toEqual([{ text: '{', color: 'gray' }]);

    const tokens2 = tokenizeJsonLine('  },');
    expect(tokens2).toEqual([
      { text: '  ' },
      { text: '}', color: 'gray' },
      { text: ',', color: 'gray' },
    ]);

    const tokens3 = tokenizeJsonLine('  "items": [');
    expect(tokens3).toEqual([
      { text: '  ' },
      { text: '"items"', color: 'cyan' },
      { text: ': ', color: 'gray' },
      { text: '[', color: 'gray' },
    ]);
  });

  it('tokenizes array items without keys', () => {
    const tokensString = tokenizeJsonLine('    "banana",');
    expect(tokensString).toEqual([
      { text: '    ' },
      { text: '"banana"', color: 'green' },
      { text: ',', color: 'gray' },
    ]);

    const tokensNumber = tokenizeJsonLine('    100,');
    expect(tokensNumber).toEqual([
      { text: '    ' },
      { text: '100', color: 'yellow' },
      { text: ',', color: 'gray' },
    ]);
  });
});
