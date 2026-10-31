import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp, useStdin, useStdout } from 'ink';
import type { TuiServer, SessionInfo, StoreInfo } from '../server.js';
import { StoreList } from './StoreList.js';
import { ActionList } from './ActionList.js';
import { StateViewer } from './StateViewer.js';

export interface AppProps {
  port: number;
  clientCount?: number;
  server?: TuiServer;
  sessions?: SessionInfo[];
  stores?: StoreInfo[];
  selectedStoreIndex?: number;
  selectedActionIndex?: number;
  viewMode?: 'snapshot' | 'diff';
  fullscreen?: boolean;
}

export const App: React.FC<AppProps> = ({
  port,
  clientCount,
  server,
  sessions: propSessions,
  stores: propStores,
  selectedStoreIndex: propSelectedStoreIndex,
  viewMode: propViewMode,
  fullscreen,
}) => {
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();
  const { stdout } = useStdout();

  const isFullscreen = fullscreen ?? Boolean(stdout?.isTTY);

  const [dimensions, setDimensions] = useState(() => ({
    columns: stdout?.columns && stdout.columns > 40 ? stdout.columns : 80,
    rows: stdout?.rows && stdout.rows > 12 ? stdout.rows : 24,
  }));

  useEffect(() => {
    if (!stdout) return;

    const handleResize = () => {
      setDimensions({
        columns: stdout.columns && stdout.columns > 40 ? stdout.columns : 80,
        rows: stdout.rows && stdout.rows > 12 ? stdout.rows : 24,
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

  const [sessions, setSessions] = useState<SessionInfo[]>(() => {
    if (propSessions) return propSessions;
    if (propStores) {
      return [
        {
          id: 'default',
          status: 'active',
          lastSeen: Date.now(),
          stores: propStores,
        },
      ];
    }
    return server ? server.getSessions() : [];
  });

  const [activePane, setActivePane] = useState<'stores' | 'actions' | 'state'>('stores');
  const [selectedStoreIndex, setSelectedStoreIndex] = useState<number>(() => {
    return propSelectedStoreIndex ?? 0;
  });
  const [selectedActionIndex, setSelectedActionIndex] = useState<number>(-1);
  const [stateScrollOffset, setStateScrollOffset] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'snapshot' | 'diff'>(() => {
    return propViewMode ?? 'snapshot';
  });

  useEffect(() => {
    if (propViewMode !== undefined) {
      setViewMode(propViewMode);
    }
  }, [propViewMode]);

  useEffect(() => {
    if (propSessions !== undefined) {
      setSessions(propSessions);
    } else if (propStores !== undefined) {
      setSessions([
        {
          id: 'default',
          status: 'active',
          lastSeen: Date.now(),
          stores: propStores,
        },
      ]);
    }
  }, [propSessions, propStores]);

  useEffect(() => {
    if (!server) return;

    const handleCount = (count: number) => {
      setServerClientCount(count);
    };

    const handleSessionsChanged = (updatedSessions: SessionInfo[]) => {
      setSessions(updatedSessions);
    };

    server.on('clientCountChanged', handleCount);
    server.on('sessionsChanged', handleSessionsChanged);

    return () => {
      server.off('clientCountChanged', handleCount);
      server.off('sessionsChanged', handleSessionsChanged);
    };
  }, [server]);

  const allStores = sessions.flatMap((s) => s.stores);
  const clampedStoreIndex =
    allStores.length > 0 ? Math.min(selectedStoreIndex, allStores.length - 1) : 0;
  const currentStore = allStores[clampedStoreIndex];
  const actions = currentStore?.actions ?? [];

  const effectiveActionIndex =
    selectedActionIndex >= 0 && selectedActionIndex < actions.length
      ? selectedActionIndex
      : Math.max(0, actions.length - 1);

  useInput(
    (input, key) => {
      if (input === 'q' || key.escape) {
        exit();
        return;
      }

      if (input === 'd') {
        setViewMode((prev) => (prev === 'snapshot' ? 'diff' : 'snapshot'));
        return;
      }

      if (key.tab) {
        if (key.shift) {
          setActivePane((prev) =>
            prev === 'state' ? 'actions' : prev === 'actions' ? 'stores' : 'state'
          );
        } else {
          setActivePane((prev) =>
            prev === 'stores' ? 'actions' : prev === 'actions' ? 'state' : 'stores'
          );
        }
        return;
      }

      if (activePane === 'stores') {
        if (allStores.length === 0) return;

        if (key.upArrow || input === 'k') {
          setSelectedStoreIndex((prev) => (prev > 0 ? prev - 1 : allStores.length - 1));
          setSelectedActionIndex(-1);
          setStateScrollOffset(0);
        } else if (key.downArrow || input === 'j') {
          setSelectedStoreIndex((prev) => (prev < allStores.length - 1 ? prev + 1 : 0));
          setSelectedActionIndex(-1);
          setStateScrollOffset(0);
        }
      } else if (activePane === 'actions') {
        if (actions.length === 0) return;

        if (key.upArrow || input === 'k') {
          setSelectedActionIndex((prev) => {
            const current = prev >= 0 ? prev : actions.length - 1;
            return current > 0 ? current - 1 : 0;
          });
          setStateScrollOffset(0);
        } else if (key.downArrow || input === 'j') {
          setSelectedActionIndex((prev) => {
            const current = prev >= 0 ? prev : actions.length - 1;
            return current < actions.length - 1 ? current + 1 : actions.length - 1;
          });
          setStateScrollOffset(0);
        }
      } else if (activePane === 'state') {
        if (key.upArrow || input === 'k') {
          setStateScrollOffset((prev) => Math.max(0, prev - 1));
        } else if (key.downArrow || input === 'j') {
          setStateScrollOffset((prev) => prev + 1);
        }
      }
    },
    { isActive: Boolean(isRawModeSupported) }
  );

  const activeCount = server ? serverClientCount : (clientCount ?? 0);
  const currentAction = actions[effectiveActionIndex];
  const previousAction =
    effectiveActionIndex > 0 ? actions[effectiveActionIndex - 1] : undefined;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      width={isFullscreen ? dimensions.columns : undefined}
      height={isFullscreen ? Math.max(dimensions.rows, 16) : undefined}
      justifyContent="space-between"
    >
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="green">
          Zustand TUI
        </Text>
        <Box>
          <Text color="gray">Listening on port {port} (WS & MCP) | Connected clients: </Text>
          <Text bold color={activeCount > 0 ? 'green' : 'yellow'}>
            {activeCount}
          </Text>
        </Box>
      </Box>

      {/* 3-Pane Body */}
      <Box flexDirection="row" flexGrow={1} minHeight={8}>
        <StoreList
          sessions={sessions}
          selectedGlobalIndex={clampedStoreIndex}
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
          previousAction={previousAction}
          fallbackState={currentStore?.currentState}
          viewMode={viewMode}
          isFocused={activePane === 'state'}
          scrollOffset={stateScrollOffset}
        />
      </Box>

      {/* Footer */}
      <Box marginTop={1} justifyContent="space-between">
        <Text color="gray">
          [Tab/Shift+Tab] Focus | [↑/↓ or j/k] Navigate | [d] Diff/Snapshot | [q/Esc] Quit
        </Text>
        <Text color="gray">Zustand State Inspector</Text>
      </Box>
    </Box>
  );
};
