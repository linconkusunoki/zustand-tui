import React from 'react';
import { Box, Text } from 'ink';
import type { StoreInfo } from '../server.js';

export interface StoreListProps {
  stores: StoreInfo[];
  selectedIndex: number;
  isFocused?: boolean;
}

export const StoreList: React.FC<StoreListProps> = ({
  stores,
  selectedIndex,
  isFocused = false,
}) => {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={isFocused ? 'cyan' : 'gray'}
      width="25%"
      minWidth={18}
      paddingX={1}
    >
      <Box marginBottom={1}>
        <Text bold underline color={isFocused ? 'cyan' : 'white'}>
          Stores ({stores.length})
        </Text>
      </Box>

      {stores.length === 0 ? (
        <Text color="gray">(No stores registered)</Text>
      ) : (
        stores.map((store, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <Box key={store.name}>
              <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
                {isSelected ? '> ' : '  '}
                {store.name}
              </Text>
            </Box>
          );
        })
      )}
    </Box>
  );
};
