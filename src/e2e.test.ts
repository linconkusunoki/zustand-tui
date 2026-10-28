import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { spawn, ChildProcess } from 'node:child_process';
import { connectToTui, registerStore } from './client.js';

describe('e2e walking skeleton and store registration', () => {
  let cliProcess: ChildProcess | null = null;
  const TEST_PORT = 8991;

  afterEach(() => {
    if (cliProcess) {
      cliProcess.kill('SIGTERM');
      cliProcess = null;
    }
  });

  it('runs the CLI, registers a store, and reflects live state updates', async () => {
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

    let state = { bears: 3 };
    const listeners = new Set<(s: typeof state) => void>();
    const fakeStore = {
      getState: () => state,
      subscribe: (fn: (s: typeof state) => void) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
    };

    registerStore(fakeStore, { name: 'bear-store', client });

    // Wait for bear-store to appear in output
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Store registration timed out')), 4000);
      const interval = setInterval(() => {
        if (output.includes('bear-store') && output.includes('"bears": 3')) {
          clearTimeout(timeout);
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });

    expect(output).toContain('bear-store');
    expect(output).toContain('"bears": 3');

    // Mutate state
    state = { bears: 4 };
    listeners.forEach((fn) => fn(state));

    // Wait for updated state in output
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('State update timed out')), 4000);
      const interval = setInterval(() => {
        if (output.includes('"bears": 4')) {
          clearTimeout(timeout);
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });

    expect(output).toContain('"bears": 4');

    client.close();
  });
});
