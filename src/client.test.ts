import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket as WsWebSocket } from 'ws';
import { createTuiServer, TuiServer } from './server.js';
import { connectToTui, registerStore, ClientConnection, resetStoreCounter } from './client.js';

describe('client connector', () => {
  let server: TuiServer | null = null;
  let client: ClientConnection | null = null;
  const TEST_PORT = 8998;

  afterEach(async () => {
    resetStoreCounter();
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

  it('registers store, dispatches initial state, and streams state changes', async () => {
    const receivedMessages: any[] = [];
    server = createTuiServer({ port: TEST_PORT });
    server.on('message', (msg) => {
      receivedMessages.push(msg);
    });
    await server.start();

    client = connectToTui({
      url: `ws://localhost:${TEST_PORT}`,
      WebSocketClass: WsWebSocket as unknown as typeof WebSocket,
    });

    let currentState = { count: 0 };
    const listeners = new Set<(state: typeof currentState) => void>();

    const fakeStore = {
      getState: () => currentState,
      subscribe: (fn: (state: typeof currentState) => void) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
    };

    registerStore(fakeStore, { name: 'counter-store', client });

    // Wait for INIT_STORE message
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (receivedMessages.some((m) => m.type === 'INIT_STORE' && m.store === 'counter-store')) {
          clearInterval(interval);
          resolve();
        }
      }, 10);
    });

    const initMsg = receivedMessages.find((m) => m.type === 'INIT_STORE');
    expect(initMsg).toEqual({
      type: 'INIT_STORE',
      store: 'counter-store',
      state: { count: 0 },
    });

    // Mutate state
    currentState = { count: 1 };
    listeners.forEach((fn) => fn(currentState));

    // Wait for SET_STATE message
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (receivedMessages.some((m) => m.type === 'SET_STATE' && m.store === 'counter-store')) {
          clearInterval(interval);
          resolve();
        }
      }, 10);
    });

    const setMsg = receivedMessages.find((m) => m.type === 'SET_STATE');
    expect(setMsg).toEqual({
      type: 'SET_STATE',
      store: 'counter-store',
      state: { count: 1 },
    });
  });

  it('falls back to Store-1, Store-2 when name is omitted', async () => {
    const receivedMessages: any[] = [];
    server = createTuiServer({ port: TEST_PORT });
    server.on('message', (msg) => {
      receivedMessages.push(msg);
    });
    await server.start();

    client = connectToTui({
      url: `ws://localhost:${TEST_PORT}`,
      WebSocketClass: WsWebSocket as unknown as typeof WebSocket,
    });

    const storeA = { getState: () => ({ a: 1 }), subscribe: () => () => {} };
    const storeB = { getState: () => ({ b: 2 }), subscribe: () => () => {} };

    registerStore(storeA, { client });
    registerStore(storeB, { client });

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (receivedMessages.length >= 2) {
          clearInterval(interval);
          resolve();
        }
      }, 10);
    });

    expect(receivedMessages[0]).toEqual({
      type: 'INIT_STORE',
      store: 'Store-1',
      state: { a: 1 },
    });
    expect(receivedMessages[1]).toEqual({
      type: 'INIT_STORE',
      store: 'Store-2',
      state: { b: 2 },
    });
  });
});
