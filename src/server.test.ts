import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { createTuiServer, TuiServer, StoreInfo } from './server.js';

describe('TuiServer', () => {
  let server: TuiServer | null = null;
  const TEST_PORT = 8999;

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
  });

  it('starts on the configured port and tracks connected client counts', async () => {
    server = createTuiServer({ port: TEST_PORT });
    await server.start();

    expect(server.getClientCount()).toBe(0);

    const client1 = new WebSocket(`ws://localhost:${TEST_PORT}`);
    await new Promise<void>((resolve) => client1.on('open', () => resolve()));

    expect(server.getClientCount()).toBe(1);

    const client2 = new WebSocket(`ws://localhost:${TEST_PORT}`);
    await new Promise<void>((resolve) => client2.on('open', () => resolve()));

    expect(server.getClientCount()).toBe(2);

    client1.close();
    await new Promise<void>((resolve) => client1.on('close', () => resolve()));

    expect(server.getClientCount()).toBe(1);

    client2.close();
    await new Promise<void>((resolve) => client2.on('close', () => resolve()));

    expect(server.getClientCount()).toBe(0);
  });

  it('tracks stores, updates current state, and records action history', async () => {
    server = createTuiServer({ port: TEST_PORT });
    const storeUpdates: StoreInfo[] = [];
    server.on('storeUpdated', (info) => {
      storeUpdates.push(info);
    });
    await server.start();

    const client = new WebSocket(`ws://localhost:${TEST_PORT}`);
    await new Promise<void>((resolve) => client.on('open', () => resolve()));

    // 1. Initialize store
    client.send(
      JSON.stringify({
        type: 'INIT_STORE',
        store: 'auth',
        state: { user: null, isLoggedIn: false },
      })
    );

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (server?.getStores().length === 1) {
          clearInterval(interval);
          resolve();
        }
      }, 10);
    });

    const store = server.getStores()[0];
    expect(store.name).toBe('auth');
    expect(store.currentState).toEqual({ user: null, isLoggedIn: false });
    expect(store.actions.length).toBe(1);
    expect(store.actions[0].action).toBe('@@INIT');
    expect(store.actions[0].state).toEqual({ user: null, isLoggedIn: false });

    // 2. Dispatch an action
    client.send(
      JSON.stringify({
        type: 'ACTION',
        store: 'auth',
        action: 'loginUser',
        state: { user: { id: 1, name: 'Alice' }, isLoggedIn: true },
        timestamp: 1700000000000,
      })
    );

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (server?.getStoreActions('auth').length === 2) {
          clearInterval(interval);
          resolve();
        }
      }, 10);
    });

    const actions = server.getStoreActions('auth');
    expect(actions.length).toBe(2);
    expect(actions[1].action).toBe('loginUser');
    expect(actions[1].state).toEqual({ user: { id: 1, name: 'Alice' }, isLoggedIn: true });
    expect(actions[1].timestamp).toBe(1700000000000);

    // Current state is also updated
    expect(server.getStores()[0].currentState).toEqual({
      user: { id: 1, name: 'Alice' },
      isLoggedIn: true,
    });

    client.close();
  });
});
