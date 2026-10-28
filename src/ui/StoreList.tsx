import React from 'react';
import { Box, Text } from 'ink';
import type { SessionInfo } from '../server.js';

export interface StoreListProps {
  sessions: SessionInfo[];
  selectedGlobalIndex: number;
  isFocused?: boolean;
}

export const StoreList: React.FC<StoreListProps> = ({
  sessions,
  selectedGlobalIndex,
  isFocused = false,
}) => {
  let currentGlobalIndex = 0;
  const totalStores = sessions.reduce((acc, s) => acc + s.stores.length, 0);

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={isFocused ? 'cyan' : 'gray'}
      width="28%"
      minWidth={22}
      paddingX={1}
    >
      <Box marginBottom={1}>
        <Text bold underline color={isFocused ? 'cyan' : 'white'}>
          Stores ({totalStores})
        </Text>
      </Box>

      {sessions.length === 0 || totalStores === 0 ? (
        <Text color="gray">(No stores registered)</Text>
      ) : (
        sessions.map((session) => {
          const isOffline = session.status === 'offline';
          return (
            <Box key={session.id} flexDirection="column" marginBottom={1}>
              {/* Session header */}
              <Box justifyContent="space-between">
                <Text bold color={isOffline ? 'gray' : 'magenta'}>
                  {session.id}
                </Text>
                <Text color={isOffline ? 'gray' : 'green'}>
                  {isOffline ? '[Offline]' : '(active)'}
                </Text>
              </Box>

              {/* Stores in this session */}
              {session.stores.map((store) => {
                const isSelected = currentGlobalIndex === selectedGlobalIndex;
                currentGlobalIndex++;

                return (
                  <Box key={`${session.id}-${store.name}`}>
                    <Text
                      color={
                        isSelected ? 'cyan' : isOffline ? 'gray' : 'white'
                      }
                      bold={isSelected}
                    >
                      {isSelected ? ' > ' : '   '}
                      {store.name}
                    </Text>
                  </Box>
                );
              })}
            </Box>
          );
        })
      )}
    </Box>
  );
};
