import React from 'react';
import { Box, Text } from 'ink';
import type { ActionRecord } from '../server.js';
import { computeDiff, DiffEntry } from '../diff.js';

export interface StateViewerProps {
  storeName?: string;
  action?: ActionRecord;
  previousAction?: ActionRecord;
  fallbackState?: unknown;
  viewMode?: 'snapshot' | 'diff';
}

export const StateViewer: React.FC<StateViewerProps> = ({
  storeName,
  action,
  previousAction,
  fallbackState,
  viewMode = 'snapshot',
}) => {
  const currentState = action ? action.state : fallbackState;
  const previousState = previousAction?.state;

  const modeTag = viewMode === 'diff' ? '[Diff]' : '[Snapshot]';
  const storeTitle = storeName
    ? action
      ? `State (${storeName} @ ${action.action}) ${modeTag}`
      : `State (${storeName}) ${modeTag}`
    : `State ${modeTag}`;

  const diffs: DiffEntry[] =
    viewMode === 'diff' ? computeDiff(previousState, currentState) : [];

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

      {!storeName && !action ? (
        <Text color="gray">(No store selected)</Text>
      ) : viewMode === 'diff' ? (
        diffs.length === 0 ? (
          <Text color="gray">(No changes in this action)</Text>
        ) : (
          diffs.map((d) => {
            if (d.kind === 'added') {
              return (
                <Box key={d.path}>
                  <Text color="green">
                    + {d.path}: {JSON.stringify(d.newValue)}
                  </Text>
                </Box>
              );
            }
            if (d.kind === 'removed') {
              return (
                <Box key={d.path}>
                  <Text color="red">
                    - {d.path}: {JSON.stringify(d.oldValue)}
                  </Text>
                </Box>
              );
            }
            return (
              <Box key={d.path}>
                <Text color="yellow">
                  ~ {d.path}: {JSON.stringify(d.oldValue)} =&gt; {JSON.stringify(d.newValue)}
                </Text>
              </Box>
            );
          })
        )
      ) : currentState === undefined ? (
        <Text color="gray">undefined</Text>
      ) : (
        <Text color="white">
          {typeof currentState === 'object' && currentState !== null
            ? JSON.stringify(currentState, null, 2)
            : String(currentState)}
        </Text>
      )}
    </Box>
  );
};
