import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import type { TuiServer } from '../server.js';

export interface AppProps {
  port: number;
  clientCount?: number;
  server?: TuiServer;
}

export const App: React.FC<AppProps> = ({ port, clientCount, server }) => {
  const [serverClientCount, setServerClientCount] = useState<number>(() => {
    return server ? server.getClientCount() : 0;
  });

  useEffect(() => {
    if (!server) return;

    const handler = (count: number) => {
      setServerClientCount(count);
    };

    server.on('clientCountChanged', handler);
    return () => {
      server.off('clientCountChanged', handler);
    };
  }, [server]);

  const activeCount = server ? serverClientCount : (clientCount ?? 0);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold color="green">
          Zustand TUI
        </Text>
        <Text color="gray">Listening on port {port}</Text>
      </Box>
      <Box marginTop={1}>
        <Text>Connected clients: </Text>
        <Text bold color={activeCount > 0 ? 'green' : 'yellow'}>
          {activeCount}
        </Text>
      </Box>
    </Box>
  );
};
