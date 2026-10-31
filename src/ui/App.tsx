import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp, useStdout, useStdin } from 'ink';
import type { TuiServer, StoreInfo, SessionInfo, ActionRecord } from '../server.js';
import { StoreList } from './StoreList.js';
import { ActionList } from './ActionList.js';
import { StateViewer } from './StateViewer.js';

export interface AppProps {
  port?: number;
  server?: TuiServer;
  clientCount?: number;
  stores?: StoreInfo[];
  sessions?: SessionInfo[];
  selectedStoreIndex?: number;
  viewMode?: 'snapshot' | 'diff';
  fullscreen?: boolean;
}

export const App: React.FC<AppProps> = ({
  port = 8080,
  server,
  clientCount,
  stores: propStores,
  sessions: propSessions,
  selectedStoreIndex: propSelectedStoreIndex,
  viewMode: propViewMode,
  fullscreen,
}) => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const { isRawModeSupported } = useStdin();

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
  // 0 = All Stores, 1..N = individual stores
  const [selectedGlobalStoreIndex, setSelectedGlobalStoreIndex] = useState<number>(() => {
    return propSelectedStoreIndex !== undefined ? propSelectedStoreIndex + 1 : 0;
  });
  const [selectedActionIndex, setSelectedActionIndex] = useState<number>(-1);
  const [stateScrollOffset, setStateScrollOffset] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'snapshot' | 'diff'>(() => {
    return propViewMode ?? 'snapshot';
  });

  // Sessions Switcher Modal state
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [modalSessionIndex, setModalSessionIndex] = useState(0);

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

  const activeSessions = sessions.filter((s) => s.status === 'active');
  const archivedSessions = sessions.filter((s) => s.status === 'offline');

  // Stores flattened from sessions in display order (active first)
  const allStores = sessions.flatMap((s) => s.stores);
  const totalStoreCount = allStores.length;
  // Index 0 is [All Stores] if stores exist
  const totalSelectableStores = totalStoreCount > 0 ? totalStoreCount + 1 : 0;

  const clampedStoreIndex =
    totalSelectableStores > 0
      ? Math.min(Math.max(0, selectedGlobalStoreIndex), totalSelectableStores - 1)
      : 0;

  const isAllStoresMode = totalStoreCount > 0 && clampedStoreIndex === 0;
  const currentStore = !isAllStoresMode && totalStoreCount > 0
    ? allStores[clampedStoreIndex - 1]
    : undefined;

  // Retrieve global actions or current store actions
  const serverGlobal = server?.getAllActions() ?? [];
  const globalActions: ActionRecord[] =
    serverGlobal.length > 0
      ? serverGlobal
      : allStores
          .flatMap((s) =>
            s.actions.map((a) => ({
              ...a,
              store: a.store || s.name,
              sessionId: a.sessionId || s.sessionId,
            }))
          )
          .sort((a, b) => a.timestamp - b.timestamp);

  const actions: ActionRecord[] = isAllStoresMode
    ? globalActions
    : currentStore?.actions ?? [];

  const effectiveActionIndex =
    selectedActionIndex >= 0 && selectedActionIndex < actions.length
      ? selectedActionIndex
      : Math.max(0, actions.length - 1);

  useInput(
    (input, key) => {
      // 1. Session Modal Navigation
      if (isSessionModalOpen) {
        if (key.escape || input === 's') {
          setIsSessionModalOpen(false);
          return;
        }

        if (input === 'c' && server) {
          server.clearArchivedSessions();
          setModalSessionIndex(0);
          return;
        }

        if (sessions.length > 0) {
          if (key.upArrow || input === 'k') {
            setModalSessionIndex((prev) => (prev > 0 ? prev - 1 : sessions.length - 1));
          } else if (key.downArrow || input === 'j') {
            setModalSessionIndex((prev) => (prev < sessions.length - 1 ? prev + 1 : 0));
          } else if (key.return) {
            setIsSessionModalOpen(false);
          }
        }
        return;
      }

      // 2. Normal View Navigation
      if (input === 'q' || key.escape) {
        exit();
        return;
      }

      if (input === 's') {
        setIsSessionModalOpen(true);
        setModalSessionIndex(0);
        return;
      }

      if (input === 'a') {
        // Jump directly to [All Stores]
        setSelectedGlobalStoreIndex(0);
        setSelectedActionIndex(-1);
        setStateScrollOffset(0);
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
        if (totalSelectableStores === 0) return;

        if (key.upArrow || input === 'k') {
          setSelectedGlobalStoreIndex((prev) =>
            prev > 0 ? prev - 1 : totalSelectableStores - 1
          );
          setSelectedActionIndex(-1);
          setStateScrollOffset(0);
        } else if (key.downArrow || input === 'j') {
          setSelectedGlobalStoreIndex((prev) =>
            prev < totalSelectableStores - 1 ? prev + 1 : 0
          );
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

  // In [All Stores] mode, find previous action for the SAME store
  let previousAction: ActionRecord | undefined;
  if (isAllStoresMode) {
    if (currentAction && effectiveActionIndex > 0) {
      previousAction = actions
        .slice(0, effectiveActionIndex)
        .reverse()
        .find((a) => a.store === currentAction.store);
    }
  } else {
    previousAction =
      effectiveActionIndex > 0 ? actions[effectiveActionIndex - 1] : undefined;
  }

  const effectiveStoreName = isAllStoresMode
    ? currentAction?.store || (allStores[0]?.name ? `${allStores[0].name}` : 'All Stores')
    : currentStore?.name;

  const effectiveFallbackState = isAllStoresMode
    ? currentAction?.state ?? allStores[0]?.currentState
    : currentStore?.currentState;

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
          {archivedSessions.length > 0 && (
            <Text color="gray"> ({archivedSessions.length} archived) | [s] Sessions</Text>
          )}
        </Box>
      </Box>

      {/* Sessions Switcher Overlay Modal */}
      {isSessionModalOpen ? (
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor="yellow"
          flexGrow={1}
          padding={1}
          minHeight={8}
        >
          <Box justifyContent="space-between" marginBottom={1}>
            <Text bold color="yellow">
              ⚡ Sessions Manager ({sessions.length})
            </Text>
            <Text color="gray">[s/Esc] Close | [c] Clear Archived</Text>
          </Box>

          {sessions.length === 0 ? (
            <Text color="gray">(No sessions registered)</Text>
          ) : (
            sessions.map((sess, idx) => {
              const isSelected = idx === modalSessionIndex;
              const isOffline = sess.status === 'offline';
              const actionCount = sess.stores.reduce((sum, s) => sum + s.actions.length, 0);
              return (
                <Box key={sess.id} justifyContent="space-between" marginBottom={1}>
                  <Text
                    bold={isSelected}
                    color={isSelected ? 'yellow' : isOffline ? 'gray' : 'green'}
                  >
                    {isSelected ? '> ' : '  '}
                    {sess.id} {isOffline ? '[Archived]' : '[Active]'}
                  </Text>
                  <Text color="gray">
                    {sess.stores.length} store(s), {actionCount} event(s) |{' '}
                    {new Date(sess.lastSeen).toLocaleTimeString()}
                  </Text>
                </Box>
              );
            })
          )}

          <Box marginTop={1}>
            <Text color="gray">
              [↑/↓ or j/k] Navigate | [Enter] Close | [c] Clear archived sessions
            </Text>
          </Box>
        </Box>
      ) : (
        /* Standard 3-Pane Body */
        <Box flexDirection="row" flexGrow={1} minHeight={8}>
          <StoreList
            sessions={sessions}
            selectedGlobalIndex={clampedStoreIndex}
            isFocused={activePane === 'stores'}
            totalAllActionsCount={globalActions.length}
            showAllStoresOption={totalStoreCount > 0}
            archivedSessionsCount={archivedSessions.length}
          />
          <ActionList
            actions={actions}
            selectedIndex={effectiveActionIndex}
            isFocused={activePane === 'actions'}
            isAllStoresMode={isAllStoresMode}
          />
          <StateViewer
            storeName={effectiveStoreName}
            action={currentAction}
            previousAction={previousAction}
            fallbackState={effectiveFallbackState}
            viewMode={viewMode}
            isFocused={activePane === 'state'}
            scrollOffset={stateScrollOffset}
          />
        </Box>
      )}

      {/* Footer */}
      <Box marginTop={1} justifyContent="space-between">
        <Text color="gray">
          [Tab] Focus | [↑/↓] Navigate | [d] Diff | [s] Sessions | [a] All Stores | [q] Quit
        </Text>
        <Text color="gray">Zustand State Inspector</Text>
      </Box>
    </Box>
  );
};
