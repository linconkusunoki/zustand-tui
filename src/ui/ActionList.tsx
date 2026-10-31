import React from 'react';
import { Box, Text } from 'ink';
import type { ActionRecord } from '../server.js';

export interface ActionListProps {
  actions: ActionRecord[];
  selectedIndex: number;
  isFocused: boolean;
  isAllStoresMode?: boolean;
}

export const ActionList: React.FC<ActionListProps> = ({
  actions,
  selectedIndex,
  isFocused,
  isAllStoresMode = false,
}) => {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={isFocused ? 'cyan' : 'gray'}
      width="32%"
      minWidth={18}
      paddingX={1}
    >
      <Box marginBottom={1}>
        <Text bold underline color={isFocused ? 'cyan' : 'white'}>
          {isAllStoresMode ? 'All Events' : 'Actions'} ({actions.length})
        </Text>
      </Box>

      {actions.length === 0 ? (
        <Text color="gray">(No actions)</Text>
      ) : (
        actions.map((act, idx) => {
          const isSelected = idx === selectedIndex;
          const timeStr = new Date(act.timestamp).toLocaleTimeString();
          return (
            <Box key={`${act.store || 'store'}-${act.id}-${idx}`} justifyContent="space-between">
              <Text color={isSelected ? 'yellow' : 'white'} bold={isSelected}>
                {isSelected ? '> ' : '  '}
                {isAllStoresMode && act.store ? (
                  <Text color={isSelected ? 'yellow' : 'cyan'}>
                    [{act.store}] {act.action}
                  </Text>
                ) : (
                  act.action
                )}
              </Text>
              <Text color="gray">{timeStr}</Text>
            </Box>
          );
        })
      )}
    </Box>
  );
};
