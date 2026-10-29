#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { createTuiServer } from './server.js';
import { createZustandMcpServer } from './mcp-server.js';
import { App } from './ui/App.js';

const portArgIndex = process.argv.indexOf('--port');
const cliPort = portArgIndex !== -1 ? Number(process.argv[portArgIndex + 1]) : NaN;
const port = !isNaN(cliPort) ? cliPort : (Number(process.env.PORT) || 8080);

const server = createTuiServer({ port });
const mcp = createZustandMcpServer({ tuiServer: server, port });

const enterAltScreen = () => {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[?1049h\x1b[H');
  }
};

const exitAltScreen = () => {
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[?1049l');
  }
};

async function main() {
  enterAltScreen();
  await server.start();
  const { unmount, waitUntilExit } = render(<App port={port} server={server} />);

  const cleanup = async () => {
    unmount();
    await mcp.stop();
    exitAltScreen();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  await waitUntilExit();
  await mcp.stop();
  exitAltScreen();
}

main().catch(async (err) => {
  console.error('Failed to start Zustand TUI:', err);
  await mcp.stop();
  exitAltScreen();
  process.exit(1);
});
