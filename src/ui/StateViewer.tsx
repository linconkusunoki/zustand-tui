import React from 'react';
import { Box, Text } from 'ink';
import type { ActionRecord } from '../server.js';

export interface StateViewerProps {
  storeName?: string;
  action?: ActionRecord;
  fallbackState?: unknown;
}

export const StateViewer: React.FC<StateViewerProps> = ({
  storeName,
  action,
  fallbackState,
}) => {
  const currentState = action ? action.state : fallbackState;
  const storeTitle = storeName
    ? action
      ? `State (${storeName} @ ${action.action})`
      : `State (${storeName})`
    : 'State';

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      flexGrow={1}
      paddingX={1}
    >
      <Box marginBottom={1}>
        <Text bold underline color="yellow">
          {storeTitle}
        </Text>
      </Box>

      {!storeName && !action ? (
        <Text color="gray">(No store selected)</Text>
      ) : currentState === undefined ? (
        <Text color="gray">undefined</Text>
      ) : (
        <Text color="white">
          {typeof currentState === 'object' && currentState !== null
            ? JSON.stringify(currentState, null, 2)
            : String(currentState)}
        </Text>
      )}
    </Box>
  );
};
