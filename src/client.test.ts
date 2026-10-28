import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket as WsWebSocket } from 'ws';
import { createTuiServer, TuiServer } from './server.js';
import {
  connectToTui,
  registerStore,
  tui,
  ClientConnection,
  resetStoreCounter,
} from './client.js';

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

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (receivedMessages.some((m) => m.type === 'SET_STATE' && m.store === 'counter-store')) {
          clearInterval(interval);
          resolve();
        }
      }, 10);
    });

    const setMsg = receivedMessages.find((m) => m.type === 'SET_STATE');
    expect(setMsg.store).toBe('counter-store');
    expect(setMsg.state).toEqual({ count: 1 });
  });

  it('tui middleware captures explicit and inferred action names', async () => {
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

    // Simulate Zustand create with tui middleware
    let state = { count: 0 };
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
      increment: () => set((prev: any) => ({ count: prev.count + 1 })),
      customSet: () => set({ count: 10 }, false, 'setTen'),
    });

    const middleware = tui('test-store', { client });
    const storeObj = middleware(storeInitializer)(api.setState, api.getState, api);

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (receivedMessages.some((m) => m.type === 'INIT_STORE')) {
          clearInterval(interval);
          resolve();
        }
      }, 10);
    });

    // 1. Calling increment() extracts caller name from stack
    storeObj.increment();

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (receivedMessages.some((m) => m.type === 'ACTION' && m.action === 'increment')) {
          clearInterval(interval);
          resolve();
        }
      }, 10);
    });

    const actionMsg1 = receivedMessages.find(
      (m) => m.type === 'ACTION' && m.action === 'increment'
    );
    expect(actionMsg1).toBeDefined();
    expect(actionMsg1.state).toEqual({ count: 1 });

    // 2. Calling customSet() uses explicit action name
    storeObj.customSet();

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (receivedMessages.some((m) => m.type === 'ACTION' && m.action === 'setTen')) {
          clearInterval(interval);
          resolve();
        }
      }, 10);
    });

    const actionMsg2 = receivedMessages.find(
      (m) => m.type === 'ACTION' && m.action === 'setTen'
    );
    expect(actionMsg2).toBeDefined();
    expect(actionMsg2.state).toEqual({ count: 10 });
  });
});
