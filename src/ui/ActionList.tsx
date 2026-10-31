import React from 'react';
import { Box, Text } from 'ink';
import type { ActionRecord } from '../server.js';

export interface ActionListProps {
  actions: ActionRecord[];
  selectedIndex: number;
  isFocused: boolean;
}

export const ActionList: React.FC<ActionListProps> = ({
  actions,
  selectedIndex,
  isFocused,
}) => {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={isFocused ? 'cyan' : 'gray'}
      width="28%"
      minWidth={16}
      paddingX={1}
    >
      <Box marginBottom={1}>
        <Text bold underline color={isFocused ? 'cyan' : 'white'}>
          Actions ({actions.length})
        </Text>
      </Box>

      {actions.length === 0 ? (
        <Text color="gray">(No actions)</Text>
      ) : (
        actions.map((act, idx) => {
          const isSelected = idx === selectedIndex;
          const timeStr = new Date(act.timestamp).toLocaleTimeString();
          return (
            <Box key={act.id} justifyContent="space-between">
              <Text color={isSelected ? 'yellow' : 'white'} bold={isSelected}>
                {isSelected ? '> ' : '  '}
                {act.action}
              </Text>
              <Text color="gray">{timeStr}</Text>
            </Box>
          );
        })
      )}
    </Box>
  );
};
