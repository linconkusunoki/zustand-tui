import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp, useStdin, useStdout } from 'ink';
import type { TuiServer, StoreInfo } from '../server.js';
import { StoreList } from './StoreList.js';
import { ActionList } from './ActionList.js';
import { StateViewer } from './StateViewer.js';

export interface AppProps {
  port: number;
  clientCount?: number;
  server?: TuiServer;
  stores?: StoreInfo[];
  selectedStoreIndex?: number;
  selectedActionIndex?: number;
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

  const [activePane, setActivePane] = useState<'stores' | 'actions'>('stores');
  const [selectedStoreIndex, setSelectedStoreIndex] = useState<number>(() => {
    return propSelectedStoreIndex ?? 0;
  });
  const [selectedActionIndex, setSelectedActionIndex] = useState<number>(-1);

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

  const clampedStoreIndex =
    stores.length > 0 ? Math.min(selectedStoreIndex, stores.length - 1) : 0;
  const currentStore = stores[clampedStoreIndex];
  const actions = currentStore?.actions ?? [];

  // Keep selected action pointing to the latest action if uninitialized or new actions arrived
  const effectiveActionIndex =
    selectedActionIndex >= 0 && selectedActionIndex < actions.length
      ? selectedActionIndex
      : Math.max(0, actions.length - 1);

  useInput(
    (input, key) => {
      if (input === 'q') {
        exit();
        return;
      }

      if (key.tab) {
        setActivePane((prev) => (prev === 'stores' ? 'actions' : 'stores'));
        return;
      }

      if (activePane === 'stores') {
        if (stores.length === 0) return;

        if (key.upArrow || input === 'k') {
          setSelectedStoreIndex((prev) => (prev > 0 ? prev - 1 : stores.length - 1));
          setSelectedActionIndex(-1); // Reset action selection to latest
        } else if (key.downArrow || input === 'j') {
          setSelectedStoreIndex((prev) => (prev < stores.length - 1 ? prev + 1 : 0));
          setSelectedActionIndex(-1); // Reset action selection to latest
        }
      } else if (activePane === 'actions') {
        if (actions.length === 0) return;

        if (key.upArrow || input === 'k') {
          setSelectedActionIndex((prev) => {
            const current = prev >= 0 ? prev : actions.length - 1;
            return current > 0 ? current - 1 : 0;
          });
        } else if (key.downArrow || input === 'j') {
          setSelectedActionIndex((prev) => {
            const current = prev >= 0 ? prev : actions.length - 1;
            return current < actions.length - 1 ? current + 1 : actions.length - 1;
          });
        }
      }
    },
    { isActive: Boolean(isRawModeSupported) }
  );

  const activeCount = server ? serverClientCount : (clientCount ?? 0);
  const currentAction = actions[effectiveActionIndex];

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

      {/* 3-Pane Body */}
      <Box flexDirection="row" flexGrow={1} minHeight={8}>
        <StoreList
          stores={stores}
          selectedIndex={clampedStoreIndex}
          isFocused={activePane === 'stores'}
        />
        <ActionList
          actions={actions}
          selectedIndex={effectiveActionIndex}
          isFocused={activePane === 'actions'}
        />
        <StateViewer
          storeName={currentStore?.name}
          action={currentAction}
          fallbackState={currentStore?.currentState}
        />
      </Box>

      {/* Footer */}
      <Box marginTop={1} justifyContent="space-between">
        <Text color="gray">[Tab] Switch Pane | [↑/↓ or j/k] Navigate | [q] Quit</Text>
        <Text color="gray">Zustand State Inspector</Text>
      </Box>
    </Box>
  );
};
