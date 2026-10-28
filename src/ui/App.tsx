import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp, useStdin, useStdout } from 'ink';
import type { TuiServer, StoreInfo } from '../server.js';
import { StoreList } from './StoreList.js';
import { StateViewer } from './StateViewer.js';

export interface AppProps {
  port: number;
  clientCount?: number;
  server?: TuiServer;
  stores?: StoreInfo[];
  selectedStoreIndex?: number;
  fullscreen?: boolean;
}

export const App: React.FC<AppProps> = ({
  port,
  clientCount,
  server,
  stores: propStores,
  selectedStoreIndex: propSelectedStoreIndex,
  fullscreen,
}) => {
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();
  const { stdout } = useStdout();

  const isFullscreen = fullscreen ?? Boolean(stdout?.isTTY);

  const [dimensions, setDimensions] = useState(() => ({
    columns: stdout?.columns ?? 80,
    rows: stdout?.rows ?? 24,
  }));

  useEffect(() => {
    if (!stdout) return;

    const handleResize = () => {
      setDimensions({
        columns: stdout.columns ?? 80,
        rows: stdout.rows ?? 24,
      });
    };

    stdout.on('resize', handleResize);
    return () => {
      stdout.off('resize', handleResize);
    };
  }, [stdout]);

  const [serverClientCount, setServerClientCount] = useState<number>(() => {
    return server ? server.getClientCount() : 0;
  });

  const [stores, setStores] = useState<StoreInfo[]>(() => {
    return propStores ?? (server ? server.getStores() : []);
  });

  const [selectedIndex, setSelectedIndex] = useState<number>(() => {
    return propSelectedStoreIndex ?? 0;
  });

  useEffect(() => {
    if (propStores !== undefined) {
      setStores(propStores);
    }
  }, [propStores]);

  useEffect(() => {
    if (!server) return;

    const handleCount = (count: number) => {
      setServerClientCount(count);
    };

    const handleStoresChanged = (updatedStores: StoreInfo[]) => {
      setStores(updatedStores);
    };

    const handleStoreUpdated = (updatedStore: StoreInfo) => {
      setStores((prev) => {
        const index = prev.findIndex((s) => s.name === updatedStore.name);
        if (index === -1) {
          return [...prev, updatedStore];
        }
        const next = [...prev];
        next[index] = updatedStore;
        return next;
      });
    };

    server.on('clientCountChanged', handleCount);
    server.on('storesChanged', handleStoresChanged);
    server.on('storeUpdated', handleStoreUpdated);

    return () => {
      server.off('clientCountChanged', handleCount);
      server.off('storesChanged', handleStoresChanged);
      server.off('storeUpdated', handleStoreUpdated);
    };
  }, [server]);

  useInput(
    (input, key) => {
      if (input === 'q') {
        exit();
        return;
      }

      if (stores.length === 0) return;

      if (key.upArrow || input === 'k') {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : stores.length - 1));
      } else if (key.downArrow || input === 'j') {
        setSelectedIndex((prev) => (prev < stores.length - 1 ? prev + 1 : 0));
      }
    },
    { isActive: Boolean(isRawModeSupported) }
  );

  const activeCount = server ? serverClientCount : (clientCount ?? 0);
  const clampedIndex = stores.length > 0 ? Math.min(selectedIndex, stores.length - 1) : 0;
  const selectedStore = stores[clampedIndex];

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      width={isFullscreen ? dimensions.columns : undefined}
      height={isFullscreen ? dimensions.rows : undefined}
      justifyContent="space-between"
    >
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="green">
          Zustand TUI
        </Text>
        <Box>
          <Text color="gray">Listening on port {port} | Connected clients: </Text>
          <Text bold color={activeCount > 0 ? 'green' : 'yellow'}>
            {activeCount}
          </Text>
        </Box>
      </Box>

      {/* 2-Pane Body */}
      <Box flexDirection="row" flexGrow={1} minHeight={8}>
        <StoreList stores={stores} selectedIndex={clampedIndex} />
        <StateViewer store={selectedStore} />
      </Box>

      {/* Footer */}
      <Box marginTop={1} justifyContent="space-between">
        <Text color="gray">[↑/↓ or j/k] Select Store | [q] Quit</Text>
        <Text color="gray">Zustand State Inspector</Text>
      </Box>
    </Box>
  );
};
