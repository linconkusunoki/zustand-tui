import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { WebSocket } from 'ws';
import { createZustandMcpServer, type ZustandMcpServerInstance } from './mcp-server.js';
import { createTuiServer } from './server.js';

describe('Zustand MCP Server', () => {
  let mcpInstance: ZustandMcpServerInstance | null = null;
  let client: Client | null = null;
  const TEST_PORT = 9123;

  function getToolResultText(res: any): string {
    return (res?.content?.[0] as any)?.text ?? '';
  }

  beforeEach(async () => {
    const tuiServer = createTuiServer({ port: TEST_PORT });
    mcpInstance = createZustandMcpServer({ tuiServer, port: TEST_PORT });
    await mcpInstance.start();

    client = new Client(
      { name: 'test-agent-client', version: '1.0.0' },
      { capabilities: {} }
    );

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await mcpInstance.connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    if (client) {
      await client.close();
      client = null;
    }
    if (mcpInstance) {
      await mcpInstance.stop();
      mcpInstance = null;
    }
  });

  it('lists available tools and resources', async () => {
    const tools = await client!.listTools();
    const toolNames = tools.tools.map((t) => t.name);

    expect(toolNames).toContain('list_stores');
    expect(toolNames).toContain('get_store_state');
    expect(toolNames).toContain('get_action_history');
    expect(toolNames).toContain('get_state_diff');

    const resources = await client!.listResources();
    expect(resources.resources.some((r) => r.uri === 'zustand://sessions')).toBe(true);
  });

  it('handles list_stores when no sessions are connected', async () => {
    const res = await client!.callTool({
      name: 'list_stores',
      arguments: {},
    });

    const parsed = JSON.parse(getToolResultText(res));
    expect(parsed.sessions).toEqual([]);
    expect(parsed.message).toContain('No active or offline sessions recorded');
  });

  it('inspects stores, states, paths, history, and diffs across sessions', async () => {
    // Connect a simulated client tab over WebSocket
    const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
    await new Promise<void>((resolve) => ws.on('open', () => resolve()));

    // 1. Initialize cart-store
    ws.send(
      JSON.stringify({
        type: 'INIT_STORE',
        sessionId: 'tab-desktop',
        store: 'cart-store',
        state: {
          items: [],
          total: 0,
          coupon: null,
          user: { name: 'Alice', tier: 'gold' },
        },
      })
    );

    // Wait for store to be registered in server
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (mcpInstance?.tuiServer.getStores().length === 1) {
          clearInterval(interval);
          resolve();
        }
      }, 10);
    });

    // 2. list_stores tool call
    const listRes = await client!.callTool({
      name: 'list_stores',
      arguments: {},
    });
    const listData = JSON.parse(getToolResultText(listRes));
    expect(listData.totalSessions).toBe(1);
    expect(listData.sessions[0].id).toBe('tab-desktop');
    expect(listData.sessions[0].stores[0].name).toBe('cart-store');

    // 3. get_store_state root snapshot (auto-resolving active session)
    const stateRes = await client!.callTool({
      name: 'get_store_state',
      arguments: { storeName: 'cart-store' },
    });
    const stateData = JSON.parse(getToolResultText(stateRes));
    expect(stateData.store).toBe('cart-store');
    expect(stateData.sessionId).toBe('tab-desktop');
    expect(stateData.sessionStatus).toBe('active');
    expect(stateData.state.total).toBe(0);

    // 4. get_store_state with path selector
    const pathRes = await client!.callTool({
      name: 'get_store_state',
      arguments: { storeName: 'cart-store', path: 'user.tier' },
    });
    const pathData = JSON.parse(getToolResultText(pathRes));
    expect(pathData.path).toBe('user.tier');
    expect(pathData.state).toBe('gold');

    // 5. Dispatch Action 1: addItem
    ws.send(
      JSON.stringify({
        type: 'ACTION',
        sessionId: 'tab-desktop',
        store: 'cart-store',
        action: 'addItem',
        state: {
          items: [{ id: 'k1', title: 'Keyboard', price: 100 }],
          total: 100,
          coupon: null,
          user: { name: 'Alice', tier: 'gold' },
        },
        timestamp: 1700000001000,
      })
    );

    // Dispatch Action 2: applyCoupon
    ws.send(
      JSON.stringify({
        type: 'ACTION',
        sessionId: 'tab-desktop',
        store: 'cart-store',
        action: 'applyCoupon',
        state: {
          items: [{ id: 'k1', title: 'Keyboard', price: 100 }],
          total: 80,
          coupon: 'DISCOUNT20',
          user: { name: 'Alice', tier: 'gold' },
        },
        timestamp: 1700000002000,
      })
    );

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (mcpInstance?.tuiServer.getStoreActions('cart-store').length === 3) {
          clearInterval(interval);
          resolve();
        }
      }, 10);
    });

    // 6. get_action_history with default metadata-first payload (no state)
    const historyRes = await client!.callTool({
      name: 'get_action_history',
      arguments: { storeName: 'cart-store' },
    });
    const historyData = JSON.parse(getToolResultText(historyRes));
    expect(historyData.totalRecordedActions).toBe(3);
    expect(historyData.actions.map((a: any) => a.action)).toEqual([
      '@@INIT',
      'addItem',
      'applyCoupon',
    ]);
    expect(historyData.actions[1].state).toBeUndefined();

    // 7. get_action_history with includeState: true
    const hydratedHistoryRes = await client!.callTool({
      name: 'get_action_history',
      arguments: { storeName: 'cart-store', includeState: true },
    });
    const hydratedData = JSON.parse(getToolResultText(hydratedHistoryRes));
    expect(hydratedData.actions[1].state.total).toBe(100);

    // 8. get_state_diff between latest two actions (applyCoupon vs addItem)
    const diffRes = await client!.callTool({
      name: 'get_state_diff',
      arguments: { storeName: 'cart-store' },
    });
    const diffData = JSON.parse(getToolResultText(diffRes));
    expect(diffData.fromAction.action).toBe('addItem');
    expect(diffData.toAction.action).toBe('applyCoupon');
    expect(diffData.summary.updated).toBeGreaterThanOrEqual(1);

    // Verify structured diff entries
    const couponDiff = diffData.diffs.find((d: any) => d.path === 'coupon');
    expect(couponDiff.kind).toBe('updated');
    expect(couponDiff.newValue).toBe('DISCOUNT20');

    const totalDiff = diffData.diffs.find((d: any) => d.path === 'total');
    expect(totalDiff.kind).toBe('updated');
    expect(totalDiff.oldValue).toBe(100);
    expect(totalDiff.newValue).toBe(80);

    // 9. Resource inspection
    const resourceRes = await client!.readResource({
      uri: 'zustand://stores/cart-store',
    });
    const storeJson = JSON.parse((resourceRes.contents[0] as any).text);
    expect(storeJson.coupon).toBe('DISCOUNT20');
    expect(storeJson.total).toBe(80);

    ws.close();
  });

  it('handles offline sessions gracefully', async () => {
    const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
    await new Promise<void>((resolve) => ws.on('open', () => resolve()));

    ws.send(
      JSON.stringify({
        type: 'INIT_STORE',
        sessionId: 'tab-reloading',
        store: 'search-store',
        state: { query: 'campervan', resultsCount: 42 },
      })
    );

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (mcpInstance?.tuiServer.getStores().length === 1) {
          clearInterval(interval);
          resolve();
        }
      }, 10);
    });

    // Close socket to simulate browser reload / disconnect
    ws.close();
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        const session = mcpInstance?.tuiServer.getSessions().find((s) => s.id === 'tab-reloading');
        if (session && session.status === 'offline') {
          clearInterval(interval);
          resolve();
        }
      }, 10);
    });

    // Verify get_store_state still succeeds and flags sessionStatus as 'offline'
    const stateRes = await client!.callTool({
      name: 'get_store_state',
      arguments: { storeName: 'search-store', sessionId: 'tab-reloading' },
    });
    const stateData = JSON.parse(getToolResultText(stateRes));
    expect(stateData.sessionStatus).toBe('offline');
    expect(stateData.state.query).toBe('campervan');
  });

  it('returns clean error responses when store or path is missing', async () => {
    const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
    await new Promise<void>((resolve) => ws.on('open', () => resolve()));

    ws.send(
      JSON.stringify({
        type: 'INIT_STORE',
        sessionId: 'sess-errors',
        store: 'user-store',
        state: { name: 'Bob' },
      })
    );

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (mcpInstance?.tuiServer.getStores().length === 1) {
          clearInterval(interval);
          resolve();
        }
      }, 10);
    });

    // Non-existent store
    const missingStoreRes = await client!.callTool({
      name: 'get_store_state',
      arguments: { storeName: 'ghost-store' },
    });
    expect(missingStoreRes.isError).toBe(true);
    expect(getToolResultText(missingStoreRes)).toContain('Store "ghost-store" not found');

    // Non-existent path
    const missingPathRes = await client!.callTool({
      name: 'get_store_state',
      arguments: { storeName: 'user-store', path: 'settings.notifications' },
    });
    expect(missingPathRes.isError).toBe(true);
    expect(getToolResultText(missingPathRes)).toContain('Path resolution error');

    ws.close();
  });

  it('serves HTTP health check and REST store snapshots', async () => {
    const healthRes = await fetch(`http://localhost:${TEST_PORT}/health`);
    expect(healthRes.status).toBe(200);
    const healthJson = (await healthRes.json()) as any;
    expect(healthJson.status).toBe('ok');
    expect(healthJson.mcpEndpoint).toBe(`http://localhost:${TEST_PORT}/sse`);

    const storesRes = await fetch(`http://localhost:${TEST_PORT}/api/stores`);
    expect(storesRes.status).toBe(200);
    const storesJson = await storesRes.json();
    expect(Array.isArray(storesJson)).toBe(true);
  });

  it('connects an MCP client directly over SSE (single-command support)', async () => {
    const sseTransport = new SSEClientTransport(new URL(`http://localhost:${TEST_PORT}/sse`));
    const sseClient = new Client(
      { name: 'sse-test-agent', version: '1.0.0' },
      { capabilities: {} }
    );
    await sseClient.connect(sseTransport);

    const tools = await sseClient.listTools();
    expect(tools.tools.map((t) => t.name)).toContain('list_stores');

    const res = await sseClient.callTool({
      name: 'list_stores',
      arguments: {},
    });
    expect(getToolResultText(res)).toContain('No active or offline sessions recorded');

    await sseClient.close();
  });
});
