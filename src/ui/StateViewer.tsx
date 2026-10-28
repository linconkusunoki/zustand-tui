import React from 'react';
import { Box, Text } from 'ink';
import type { StoreInfo } from '../server.js';

export interface StateViewerProps {
  store?: StoreInfo;
}

export const StateViewer: React.FC<StateViewerProps> = ({ store }) => {
  const storeTitle = store ? `State (${store.name})` : 'State';

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

      {!store ? (
        <Text color="gray">(No store selected)</Text>
      ) : store.currentState === undefined ? (
        <Text color="gray">undefined</Text>
      ) : (
        <Text color="white">
          {typeof store.currentState === 'object' && store.currentState !== null
            ? JSON.stringify(store.currentState, null, 2)
            : String(store.currentState)}
        </Text>
      )}
    </Box>
  );
};
