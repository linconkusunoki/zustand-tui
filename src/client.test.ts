import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket as WsWebSocket } from 'ws';
import { createTuiServer, TuiServer } from './server.js';
import { connectToTui, ClientConnection } from './client.js';

describe('client connector', () => {
  let server: TuiServer | null = null;
  let client: ClientConnection | null = null;
  const TEST_PORT = 8998;

  afterEach(async () => {
    if (client) {
      client.close();
      client = null;
    }
    if (server) {
      await server.stop();
      server = null;
    }
  });

  it('connects to TUI server and updates connection status', async () => {
    server = createTuiServer({ port: TEST_PORT });
    await server.start();

    expect(server.getClientCount()).toBe(0);

    client = connectToTui({
      url: `ws://localhost:${TEST_PORT}`,
      WebSocketClass: WsWebSocket as unknown as typeof WebSocket,
    });

    // Wait until connected
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (client?.isConnected()) {
          clearInterval(interval);
          resolve();
        }
      }, 10);
    });

    expect(client.isConnected()).toBe(true);
    expect(server.getClientCount()).toBe(1);

    client.close();

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (server?.getClientCount() === 0) {
          clearInterval(interval);
          resolve();
        }
      }, 10);
    });

    expect(client.isConnected()).toBe(false);
    expect(server.getClientCount()).toBe(0);
  });
});
