import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createTuiServer, type TuiServer, type SessionInfo, type StoreInfo, type ActionRecord } from './server.js';
import { resolvePath } from './path-selector.js';
import { computeDiff, type StateDiff } from './diff.js';

export interface ZustandMcpServerOptions {
  port?: number;
  maxActionsPerStore?: number;
  tuiServer?: TuiServer;
}

export interface ZustandMcpServerInstance {
  mcpServer: Server;
  tuiServer: TuiServer;
  start(): Promise<void>;
  stop(): Promise<void>;
  connect(transport: Transport): Promise<void>;
  attachToTuiServer(): void;
}

export function findTargetSession(tuiServer: TuiServer, sessionId?: string): SessionInfo | undefined {
  const sessions = tuiServer.getSessions();
  if (sessions.length === 0) {
    return undefined;
  }

  if (sessionId) {
    return sessions.find((s) => s.id === sessionId);
  }

  // Pick the most recent active session, falling back to most recent offline session
  return [...sessions].sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (a.status !== 'active' && b.status === 'active') return 1;
    return b.lastSeen - a.lastSeen;
  })[0];
}

export function findStoreInSession(
  session: SessionInfo,
  storeName: string
): StoreInfo | undefined {
  return session.stores.find((s) => s.name === storeName);
}

export function buildMcpServer(tuiServer: TuiServer): Server {
  const mcpServer = new Server(
    {
      name: 'zustand-mcp-server',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // 1. Tool Listing
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'list_stores',
        description:
          'Lists all connected sessions (active and offline) and their registered Zustand stores with action counts.',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Optional session ID filter (e.g. "tab-desktop"). If omitted, lists all sessions.',
            },
          },
        },
      },
      {
        name: 'get_store_state',
        description:
          'Get the latest state snapshot for a given Zustand store. Supports dot-notation path selectors (e.g. "user.profile" or "items[0]").',
        inputSchema: {
          type: 'object',
          properties: {
            storeName: {
              type: 'string',
              description: 'Name of the store (e.g. "cart-store" or "auth-store").',
            },
            sessionId: {
              type: 'string',
              description:
                'Optional session ID. When omitted, automatically resolves to the most recently active session.',
            },
            path: {
              type: 'string',
              description:
                'Optional dot-notation or array-bracketed path selector (e.g. "user.email", "cart.items[0]") to inspect a specific sub-tree.',
            },
          },
          required: ['storeName'],
        },
      },
      {
        name: 'get_action_history',
        description:
          'Get the chronological action timeline for a store with lightweight metadata by default, and opt-in state hydration.',
        inputSchema: {
          type: 'object',
          properties: {
            storeName: {
              type: 'string',
              description: 'Name of the store.',
            },
            sessionId: {
              type: 'string',
              description:
                'Optional session ID. When omitted, resolves to the most recently active session.',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of recent actions to return. Defaults to 20.',
            },
            includeState: {
              type: 'boolean',
              description:
                'Whether to include full state snapshot for each action. Defaults to false to minimize token consumption.',
            },
          },
          required: ['storeName'],
        },
      },
      {
        name: 'get_state_diff',
        description:
          'Get a structured machine-readable JSON diff of state mutations between two actions or consecutive dispatches.',
        inputSchema: {
          type: 'object',
          properties: {
            storeName: {
              type: 'string',
              description: 'Name of the store.',
            },
            sessionId: {
              type: 'string',
              description:
                'Optional session ID. When omitted, resolves to the most recently active session.',
            },
            fromActionId: {
              type: 'string',
              description:
                'Optional starting action ID (e.g. "1"). Defaults to the penultimate action (or @@INIT if only one action).',
            },
            toActionId: {
              type: 'string',
              description:
                'Optional ending action ID. Defaults to the latest action.',
            },
          },
          required: ['storeName'],
        },
      },
    ],
  }));

  // 2. Tool Execution
  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === 'list_stores') {
      const filterSessionId = args?.sessionId ? String(args.sessionId) : undefined;
      const allSessions = tuiServer.getSessions();

      if (allSessions.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  sessions: [],
                  message: `No active or offline sessions recorded. Ensure your frontend application is instrumented with tui() and running on ws://localhost:${tuiServer.port}.`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const sessionsToReport = filterSessionId
        ? allSessions.filter((s) => s.id === filterSessionId)
        : allSessions;

      const result = {
        totalSessions: sessionsToReport.length,
        sessions: sessionsToReport.map((s) => ({
          id: s.id,
          status: s.status,
          lastSeen: s.lastSeen,
          stores: s.stores.map((st) => ({
            name: st.name,
            actionCount: st.actions.length,
            lastAction: st.actions[st.actions.length - 1]?.action ?? '@@INIT',
          })),
        })),
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }

    if (name === 'get_store_state') {
      const storeName = String(args?.storeName ?? '');
      const reqSessionId = args?.sessionId ? String(args.sessionId) : undefined;
      const path = args?.path ? String(args.path) : undefined;

      const session = findTargetSession(tuiServer, reqSessionId);
      if (!session) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `No sessions found. Ensure the application is connected to ws://localhost:${tuiServer.port}.`,
            },
          ],
        };
      }

      const store = findStoreInSession(session, storeName);
      if (!store) {
        const availableStores = session.stores.map((s) => s.name).join(', ') || 'none';
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Store "${storeName}" not found in session "${session.id}". Available stores: [${availableStores}].`,
            },
          ],
        };
      }

      const pathRes = resolvePath(store.currentState, path);
      if (!pathRes.found) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Path resolution error for store "${storeName}": ${pathRes.error}`,
            },
          ],
        };
      }

      const result = {
        store: store.name,
        sessionId: session.id,
        sessionStatus: session.status,
        lastSeen: session.lastSeen,
        path: path || null,
        state: pathRes.value,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }

    if (name === 'get_action_history') {
      const storeName = String(args?.storeName ?? '');
      const reqSessionId = args?.sessionId ? String(args.sessionId) : undefined;
      const limit = typeof args?.limit === 'number' && args.limit > 0 ? args.limit : 20;
      const includeState = Boolean(args?.includeState);

      const session = findTargetSession(tuiServer, reqSessionId);
      if (!session) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `No sessions found. Ensure the application is connected to ws://localhost:${tuiServer.port}.`,
            },
          ],
        };
      }

      const store = findStoreInSession(session, storeName);
      if (!store) {
        const availableStores = session.stores.map((s) => s.name).join(', ') || 'none';
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Store "${storeName}" not found in session "${session.id}". Available stores: [${availableStores}].`,
            },
          ],
        };
      }

      const slicedActions = store.actions.slice(-limit);
      const actions = slicedActions.map((rec) => {
        if (includeState) {
          return {
            id: rec.id,
            action: rec.action,
            timestamp: rec.timestamp,
            state: rec.state,
          };
        }
        return {
          id: rec.id,
          action: rec.action,
          timestamp: rec.timestamp,
        };
      });

      const result = {
        store: store.name,
        sessionId: session.id,
        sessionStatus: session.status,
        totalRecordedActions: store.actions.length,
        returnedActionsCount: actions.length,
        actions,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }

    if (name === 'get_state_diff') {
      const storeName = String(args?.storeName ?? '');
      const reqSessionId = args?.sessionId ? String(args.sessionId) : undefined;
      const fromActionId = args?.fromActionId ? String(args.fromActionId) : undefined;
      const toActionId = args?.toActionId ? String(args.toActionId) : undefined;

      const session = findTargetSession(tuiServer, reqSessionId);
      if (!session) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `No sessions found. Ensure the application is connected to ws://localhost:${tuiServer.port}.`,
            },
          ],
        };
      }

      const store = findStoreInSession(session, storeName);
      if (!store) {
        const availableStores = session.stores.map((s) => s.name).join(', ') || 'none';
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Store "${storeName}" not found in session "${session.id}". Available stores: [${availableStores}].`,
            },
          ],
        };
      }

      if (store.actions.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  store: store.name,
                  sessionId: session.id,
                  message: 'No actions recorded yet for this store.',
                  diffs: [],
                },
                null,
                2
              ),
            },
          ],
        };
      }

      let fromAction: ActionRecord | undefined;
      let toAction: ActionRecord | undefined;

      if (toActionId) {
        toAction = store.actions.find((a) => a.id === toActionId);
      } else {
        toAction = store.actions[store.actions.length - 1];
      }

      if (!toAction) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Target action "${toActionId}" not found in store "${storeName}".`,
            },
          ],
        };
      }

      if (fromActionId) {
        fromAction = store.actions.find((a) => a.id === fromActionId);
        if (!fromAction) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: `Base action "${fromActionId}" not found in store "${storeName}".`,
              },
            ],
          };
        }
      } else {
        const toIndex = store.actions.findIndex((a) => a.id === toAction!.id);
        if (toIndex > 0) {
          fromAction = store.actions[toIndex - 1];
        } else {
          // If comparing first action, previous state is empty/undefined
          fromAction = {
            id: '0',
            action: '@@EMPTY',
            state: undefined,
            timestamp: toAction.timestamp,
          };
        }
      }

      const diffs: StateDiff = computeDiff(fromAction.state, toAction.state);
      const summary = {
        added: diffs.filter((d) => d.kind === 'added').length,
        removed: diffs.filter((d) => d.kind === 'removed').length,
        updated: diffs.filter((d) => d.kind === 'updated').length,
        totalChanges: diffs.length,
      };

      const result = {
        store: store.name,
        sessionId: session.id,
        sessionStatus: session.status,
        fromAction: {
          id: fromAction.id,
          action: fromAction.action,
          timestamp: fromAction.timestamp,
        },
        toAction: {
          id: toAction.id,
          action: toAction.action,
          timestamp: toAction.timestamp,
        },
        summary,
        diffs,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  // 3. Resource Listing
  mcpServer.setRequestHandler(ListResourcesRequestSchema, async () => {
    const sessions = tuiServer.getSessions();
    const storeNames = new Set<string>();

    for (const session of sessions) {
      for (const store of session.stores) {
        storeNames.add(store.name);
      }
    }

    const resources = [
      {
        uri: 'zustand://sessions',
        name: 'Zustand Sessions Summary',
        description: 'Overview of all active and offline sessions with connected stores.',
        mimeType: 'application/json',
      },
      ...Array.from(storeNames).map((name) => ({
        uri: `zustand://stores/${name}`,
        name: `Zustand Store: ${name}`,
        description: `Current state snapshot of store "${name}" in the active session.`,
        mimeType: 'application/json',
      })),
    ];

    return { resources };
  });

  // 4. Resource Reading
  mcpServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    if (uri === 'zustand://sessions') {
      const sessions = tuiServer.getSessions();
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(sessions, null, 2),
          },
        ],
      };
    }

    if (uri.startsWith('zustand://stores/')) {
      const storeName = uri.replace('zustand://stores/', '');
      const session = findTargetSession(tuiServer);

      if (!session) {
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({ error: 'No active sessions' }),
            },
          ],
        };
      }

      const store = findStoreInSession(session, storeName);
      if (!store) {
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                error: `Store "${storeName}" not found in session "${session.id}"`,
              }),
            },
          ],
        };
      }

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(store.currentState, null, 2),
          },
        ],
      };
    }

    throw new Error(`Resource not found: ${uri}`);
  });

  return mcpServer;
}

export function createZustandMcpServer(options: ZustandMcpServerOptions = {}): ZustandMcpServerInstance {
  const port = options.port ?? 8080;
  const tuiServer = options.tuiServer ?? createTuiServer({
    port,
    maxActionsPerStore: options.maxActionsPerStore ?? 100,
  });

  const mcpServer = buildMcpServer(tuiServer);
  const activeServers = new Set<Server>([mcpServer]);

  // Emit resource update notification when a store changes
  tuiServer.on('storeUpdated', (storeInfo) => {
    for (const server of activeServers) {
      server
        .notification({
          method: 'notifications/resources/updated',
          params: {
            uri: `zustand://stores/${storeInfo.name}`,
          },
        })
        .catch(() => {
          // Ignore notification failures when client transport is not connected or closing
        });
    }
  });

  const sseSessions = new Map<string, { transport: SSEServerTransport; server: Server }>();

  const attachToTuiServer = () => {
    tuiServer.setHttpHandler(async (req, res) => {
      if (req.url === '/sse') {
        const transport = new SSEServerTransport('/message', res);
        const sessionServer = buildMcpServer(tuiServer);
        activeServers.add(sessionServer);

        sseSessions.set(transport.sessionId, { transport, server: sessionServer });
        let isClosing = false;
        transport.onclose = () => {
          if (isClosing) return;
          isClosing = true;
          sseSessions.delete(transport.sessionId);
          activeServers.delete(sessionServer);
        };

        await sessionServer.connect(transport);
        await transport.start();
        return true;
      }

      if (req.url?.startsWith('/message') && req.method === 'POST') {
        const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const sessionId = parsedUrl.searchParams.get('sessionId');
        const session = sessionId
          ? sseSessions.get(sessionId)
          : sseSessions.values().next().value;

        if (session) {
          await session.transport.handlePostMessage(req, res);
          return true;
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'SSE session not found or expired' }));
          return true;
        }
      }

      return false;
    });
  };

  // Attach automatically so TUI server always exposes MCP SSE endpoint
  attachToTuiServer();

  return {
    mcpServer,
    tuiServer,
    start: async () => {
      await tuiServer.start();
    },
    stop: async () => {
      for (const session of sseSessions.values()) {
        try {
          await session.transport.close();
          await session.server.close();
        } catch {
          // ignore error on close
        }
      }
      sseSessions.clear();
      activeServers.clear();
      await tuiServer.stop();
      await mcpServer.close();
    },
    connect: async (transport: Transport) => {
      await mcpServer.connect(transport);
    },
    attachToTuiServer,
  };
}
