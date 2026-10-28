#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { createTuiServer } from './server.js';
import { App } from './ui/App.js';

const portArgIndex = process.argv.indexOf('--port');
const cliPort = portArgIndex !== -1 ? Number(process.argv[portArgIndex + 1]) : NaN;
const port = !isNaN(cliPort) ? cliPort : (Number(process.env.PORT) || 8080);

const server = createTuiServer({ port });

async function main() {
  await server.start();
  const { unmount, waitUntilExit } = render(<App port={port} server={server} />);

  const cleanup = async () => {
    unmount();
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  await waitUntilExit();
  await server.stop();
}

main().catch(async (err) => {
  console.error('Failed to start Zustand TUI:', err);
  await server.stop();
  process.exit(1);
});
