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
        sessionId: 'sess-1',
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
        sessionId: 'sess-1',
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

    expect(server.getStores()[0].currentState).toEqual({
      user: { id: 1, name: 'Alice' },
      isLoggedIn: true,
    });

    client.close();
  });

  it('isolates sessions, marks disconnected sessions as offline, and preserves state', async () => {
    server = createTuiServer({ port: TEST_PORT });
    await server.start();

    const client1 = new WebSocket(`ws://localhost:${TEST_PORT}`);
    await new Promise<void>((resolve) => client1.on('open', () => resolve()));

    // Client 1 registers store in session 'tab-1'
    client1.send(
      JSON.stringify({
        type: 'INIT_STORE',
        sessionId: 'tab-1',
        store: 'cart',
        state: { items: ['laptop'] },
      })
    );

    const client2 = new WebSocket(`ws://localhost:${TEST_PORT}`);
    await new Promise<void>((resolve) => client2.on('open', () => resolve()));

    // Client 2 registers store in session 'tab-2'
    client2.send(
      JSON.stringify({
        type: 'INIT_STORE',
        sessionId: 'tab-2',
        store: 'cart',
        state: { items: ['phone'] },
      })
    );

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (server?.getSessions().length === 2) {
          clearInterval(interval);
          resolve();
        }
      }, 10);
    });

    const sessions = server.getSessions();
    expect(sessions.length).toBe(2);

    const session1 = sessions.find((s) => s.id === 'tab-1');
    const session2 = sessions.find((s) => s.id === 'tab-2');

    expect(session1?.status).toBe('active');
    expect(session1?.stores[0].currentState).toEqual({ items: ['laptop'] });

    expect(session2?.status).toBe('active');
    expect(session2?.stores[0].currentState).toEqual({ items: ['phone'] });

    // Disconnect client 1
    client1.close();
    await new Promise<void>((resolve) => client1.on('close', () => resolve()));

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        const s = server?.getSessions().find((item) => item.id === 'tab-1');
        if (s?.status === 'offline') {
          clearInterval(interval);
          resolve();
        }
      }, 10);
    });

    // Session 1 is offline, but its store state is preserved!
    const updatedSession1 = server.getSessions().find((s) => s.id === 'tab-1');
    expect(updatedSession1?.status).toBe('offline');
    expect(updatedSession1?.stores[0].currentState).toEqual({ items: ['laptop'] });

    // Session 2 is still active
    const updatedSession2 = server.getSessions().find((s) => s.id === 'tab-2');
    expect(updatedSession2?.status).toBe('active');

    client2.close();
  });
});
