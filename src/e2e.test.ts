import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { spawn, ChildProcess } from 'node:child_process';
import { connectToTui, tui } from './client.js';

describe('e2e walking skeleton and store registration', () => {
  let cliProcess: ChildProcess | null = null;
  const TEST_PORT = 8991;

  afterEach(() => {
    if (cliProcess) {
      cliProcess.kill('SIGTERM');
      cliProcess = null;
    }
  });

  it('runs the CLI, registers a store, and reflects live action history', async () => {
    // In CI environments (e.g. GitHub Actions), Ink suppresses live stdout rendering unless CI is set to 'false'
    const testEnv = {
      ...process.env,
      CI: 'false',
      CONTINUOUS_INTEGRATION: 'false',
    };

    cliProcess = spawn('node', ['./dist/cli.js', '--port', String(TEST_PORT)], {
      cwd: process.cwd(),
      env: testEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    cliProcess.stdout?.on('data', (data) => {
      output += data.toString();
    });
    cliProcess.stderr?.on('data', (data) => {
      output += data.toString();
    });
    cliProcess.on('error', (err) => {
      output += `\n[CLI error]: ${err.message}`;
    });

    // Wait for the server to be listening
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('CLI startup timed out. Output was:\n' + output)),
        10000
      );
      const interval = setInterval(() => {
        if (output.includes('Zustand TUI') || output.includes(String(TEST_PORT))) {
          clearTimeout(timeout);
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });

    expect(output).toContain(String(TEST_PORT));

    // Connect client using tui middleware
    const client = connectToTui({
      url: `ws://localhost:${TEST_PORT}`,
      WebSocketClass: WebSocket as unknown as typeof globalThis.WebSocket,
    });

    let state = { bears: 3 };
    const listeners = new Set<(s: any) => void>();
    const api = {
      getState: () => state,
      setState: (next: any) => {
        state = typeof next === 'function' ? next(state) : next;
        listeners.forEach((l) => l(state));
      },
      subscribe: (fn: any) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
    };

    const storeInitializer = (set: any) => ({
      addBear: () => set((prev: any) => ({ bears: prev.bears + 1 })),
    });

    const storeObj = tui('bear-store', { client })(storeInitializer)(
      api.setState,
      api.getState,
      api
    );

    // Wait for bear-store and @@INIT to appear in output
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Store registration timed out. Output was:\n' + output)),
        10000
      );
      const interval = setInterval(() => {
        if (
          output.includes('bear-store') &&
          output.includes('@@INIT') &&
          output.includes('"bears": 3')
        ) {
          clearTimeout(timeout);
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });

    expect(output).toContain('bear-store');
    expect(output).toContain('@@INIT');
    expect(output).toContain('"bears": 3');

    // Trigger action
    storeObj.addBear();

    // Wait for addBear action to appear in output
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Action dispatch timed out. Output was:\n' + output)),
        10000
      );
      const interval = setInterval(() => {
        if (output.includes('addBear') && output.includes('"bears": 4')) {
          clearTimeout(timeout);
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });

    expect(output).toContain('addBear');
    expect(output).toContain('"bears": 4');

    client.close();
  }, 30000);
});
