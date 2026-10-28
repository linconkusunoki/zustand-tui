import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { spawn, ChildProcess } from 'node:child_process';
import { connectToTui } from './client.js';

describe('e2e walking skeleton', () => {
  let cliProcess: ChildProcess | null = null;
  const TEST_PORT = 8991;

  afterEach(() => {
    if (cliProcess) {
      cliProcess.kill('SIGTERM');
      cliProcess = null;
    }
  });

  it('runs the CLI, accepts connections, and logs status', async () => {
    cliProcess = spawn('node', ['./dist/cli.js', '--port', String(TEST_PORT)], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    cliProcess.stdout?.on('data', (data) => {
      output += data.toString();
    });

    // Wait for the server to be listening
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('CLI startup timed out')), 4000);
      const interval = setInterval(() => {
        if (output.includes('Zustand TUI') || output.includes(String(TEST_PORT))) {
          clearTimeout(timeout);
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });

    expect(output).toContain(String(TEST_PORT));

    // Connect client
    const client = connectToTui({
      url: `ws://localhost:${TEST_PORT}`,
      WebSocketClass: WebSocket as unknown as typeof globalThis.WebSocket,
    });

    // Wait for client to connect
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (client.isConnected()) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });

    expect(client.isConnected()).toBe(true);

    client.close();
  });
});
