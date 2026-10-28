import React from 'react';
import { Text } from 'ink';

export interface Token {
  text: string;
  color?: string;
  dimColor?: boolean;
}

function parseValueTokens(valPart: string, tokens: Token[]) {
  let rest = valPart;
  let hasTrailingComma = false;

  if (rest.endsWith(',')) {
    hasTrailingComma = true;
    rest = rest.slice(0, -1);
  }

  if (rest.startsWith('"') && rest.endsWith('"')) {
    tokens.push({ text: rest, color: 'green' });
  } else if (/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(rest)) {
    tokens.push({ text: rest, color: 'yellow' });
  } else if (rest === 'true' || rest === 'false') {
    tokens.push({ text: rest, color: 'magenta' });
  } else if (rest === 'null') {
    tokens.push({ text: 'null', color: 'gray', dimColor: true });
  } else if (rest === '{' || rest === '[' || rest === '}' || rest === ']') {
    tokens.push({ text: rest, color: 'gray' });
  } else {
    tokens.push({ text: rest, color: 'white' });
  }

  if (hasTrailingComma) {
    tokens.push({ text: ',', color: 'gray' });
  }
}

export function tokenizeJsonLine(line: string): Token[] {
  const tokens: Token[] = [];

  const indentMatch = line.match(/^(\s*)/);
  const indent = indentMatch ? indentMatch[1] : '';
  if (indent.length > 0) {
    tokens.push({ text: indent });
  }

  const trimmed = line.slice(indent.length);
  if (!trimmed) {
    return tokens;
  }

  // Key-value pair: "key": value
  const kvMatch = trimmed.match(/^"([^"\\]*(?:\\.[^"\\]*)*)"\s*:\s*(.*)$/);
  if (kvMatch) {
    const key = `"${kvMatch[1]}"`;
    const valPart = kvMatch[2];

    tokens.push({ text: key, color: 'cyan' });
    tokens.push({ text: ': ', color: 'gray' });
    parseValueTokens(valPart, tokens);
    return tokens;
  }

  parseValueTokens(trimmed, tokens);
  return tokens;
}

export const JsonLine: React.FC<{ line: string }> = ({ line }) => {
  const tokens = tokenizeJsonLine(line);

  return (
    <Text>
      {tokens.map((token, idx) => (
        <Text key={idx} color={token.color} dimColor={token.dimColor}>
          {token.text}
        </Text>
      ))}
    </Text>
  );
};
