import { EventEmitter } from 'node:events';
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type { TuiClientMessage } from './protocol.js';

export type HttpRequestHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse
) => boolean | Promise<boolean>;

export interface TuiServerOptions {
  port?: number;
  maxActionsPerStore?: number;
  httpHandler?: HttpRequestHandler;
}

export interface ActionRecord {
  id: string;
  action: string;
  state: unknown;
  timestamp: number;
  store?: string;
  sessionId?: string;
}

export interface StoreInfo {
  name: string;
  sessionId: string;
  currentState: unknown;
  actions: ActionRecord[];
}

export interface SessionInfo {
  id: string;
  status: 'active' | 'offline';
  stores: StoreInfo[];
  lastSeen: number;
}

export interface TuiServer extends EventEmitter {
  port: number;
  httpServer?: http.Server;
  start(): Promise<void>;
  stop(): Promise<void>;
  getClientCount(): number;
  getSessions(): SessionInfo[];
  getActiveSessions(): SessionInfo[];
  getArchivedSessions(): SessionInfo[];
  clearArchivedSessions(): void;
  getStores(sessionId?: string): StoreInfo[];
  getStoreActions(storeName: string, sessionId?: string): ActionRecord[];
  getAllActions(sessionId?: string): ActionRecord[];
  setHttpHandler(handler: HttpRequestHandler): void;
}

export function createTuiServer(options: TuiServerOptions = {}): TuiServer {
  const port = options.port ?? 8080;
  const maxActions = options.maxActionsPerStore ?? 100;
  const emitter = new EventEmitter() as TuiServer;
  let httpServer: http.Server | null = null;
  const httpSockets = new Set<import('node:net').Socket>();
  let wss: WebSocketServer | null = null;
  const clients = new Set<WebSocket>();
  let customHttpHandler: HttpRequestHandler | undefined = options.httpHandler;

  const sessions = new Map<string, SessionInfo>();
  const socketSessionMap = new Map<WebSocket, string>();
  const sessionSocketsMap = new Map<string, Set<WebSocket>>();
  let globalActions: ActionRecord[] = [];

  emitter.port = port;

  emitter.setHttpHandler = (handler: HttpRequestHandler) => {
    customHttpHandler = handler;
  };

  emitter.getClientCount = () => {
    return clients.size;
  };

  emitter.getSessions = () => {
    // Sort so active sessions are always first, ordered by most recently seen
    return Array.from(sessions.values()).sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      return b.lastSeen - a.lastSeen;
    });
  };

  emitter.getActiveSessions = () => {
    return emitter.getSessions().filter((s) => s.status === 'active');
  };

  emitter.getArchivedSessions = () => {
    return emitter.getSessions().filter((s) => s.status === 'offline');
  };

  emitter.clearArchivedSessions = () => {
    for (const [id, session] of sessions.entries()) {
      if (session.status === 'offline') {
        sessions.delete(id);
      }
    }
    globalActions = globalActions.filter((a) => {
      const sess = sessions.get(a.sessionId || '');
      return sess && sess.status === 'active';
    });
    emitter.emit('sessionsChanged', emitter.getSessions());
  };

  emitter.getStores = (sessionId?: string) => {
    if (sessionId) {
      return sessions.get(sessionId)?.stores ?? [];
    }
    const allStores: StoreInfo[] = [];
    for (const session of emitter.getSessions()) {
      allStores.push(...session.stores);
    }
    return allStores;
  };

  emitter.getStoreActions = (storeName: string, sessionId?: string) => {
    if (storeName === 'all' || storeName === '*' || storeName === '__ALL__') {
      return emitter.getAllActions(sessionId);
    }
    const stores = emitter.getStores(sessionId);
    const store = stores.find((s) => s.name === storeName);
    return store?.actions ?? [];
  };

  emitter.getAllActions = (sessionId?: string) => {
    if (sessionId) {
      return globalActions.filter((a) => a.sessionId === sessionId);
    }
    return globalActions;
  };

  emitter.start = () => {
    return new Promise<void>((resolve, reject) => {
      try {
        httpServer = http.createServer(async (req, res) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', '*');

          if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
          }

          if (customHttpHandler) {
            try {
              const handled = await customHttpHandler(req, res);
              if (handled) return;
            } catch (err) {
              if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(
                  JSON.stringify({
                    error: 'Internal server error in HTTP handler',
                    details: String(err),
                  })
                );
              }
              return;
            }
          }

          if (req.url === '/health' || req.url === '/') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                status: 'ok',
                port,
                clients: clients.size,
                sessions: sessions.size,
                mcpEndpoint: `http://localhost:${port}/sse`,
                apiEndpoint: `http://localhost:${port}/api/stores`,
              })
            );
            return;
          }

          if (req.url === '/api/stores') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(emitter.getStores(), null, 2));
            return;
          }

          if (req.url === '/api/actions') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(emitter.getAllActions(), null, 2));
            return;
          }

          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
        });

        emitter.httpServer = httpServer;

        httpServer.on('connection', (socket) => {
          httpSockets.add(socket);
          socket.on('close', () => {
            httpSockets.delete(socket);
          });
        });

        httpServer.on('error', (err) => {
          emitter.emit('error', err);
          reject(err);
        });

        wss = new WebSocketServer({ server: httpServer });

        wss.on('error', (err) => {
          emitter.emit('error', err);
          reject(err);
        });

        wss.on('connection', (ws) => {
          clients.add(ws);
          emitter.emit('clientConnected', ws);
          emitter.emit('clientCountChanged', clients.size);

          ws.on('message', (rawData) => {
            try {
              const msg = JSON.parse(rawData.toString()) as TuiClientMessage;
              emitter.emit('message', msg, ws);

              const sessionId = msg.sessionId || 'default';
              socketSessionMap.set(ws, sessionId);

              let socketSet = sessionSocketsMap.get(sessionId);
              if (!socketSet) {
                socketSet = new Set();
                sessionSocketsMap.set(sessionId, socketSet);
              }
              socketSet.add(ws);

              let session = sessions.get(sessionId);
              if (!session) {
                session = {
                  id: sessionId,
                  status: 'active',
                  stores: [],
                  lastSeen: Date.now(),
                };
                sessions.set(sessionId, session);
              } else {
                session.status = 'active';
                session.lastSeen = Date.now();
              }

              if (msg.type === 'INIT_STORE') {
                const initAction: ActionRecord = {
                  id: '1',
                  action: '@@INIT',
                  state: msg.state,
                  timestamp: Date.now(),
                  store: msg.store,
                  sessionId,
                };

                let storeInfo = session.stores.find((s) => s.name === msg.store);
                if (!storeInfo) {
                  storeInfo = {
                    name: msg.store,
                    sessionId,
                    currentState: msg.state,
                    actions: [initAction],
                  };
                  session.stores.push(storeInfo);
                } else {
                  storeInfo.currentState = msg.state;
                  storeInfo.actions = [initAction];
                }

                globalActions.push(initAction);
                if (globalActions.length > maxActions * 10) {
                  globalActions = globalActions.slice(-(maxActions * 10));
                }

                emitter.emit('storeUpdated', storeInfo);
                emitter.emit('storesChanged', emitter.getStores());
                emitter.emit('sessionsChanged', emitter.getSessions());
              } else if (msg.type === 'ACTION' || msg.type === 'SET_STATE') {
                let storeInfo = session.stores.find((s) => s.name === msg.store);
                if (!storeInfo) {
                  storeInfo = {
                    name: msg.store,
                    sessionId,
                    currentState: msg.state,
                    actions: [],
                  };
                  session.stores.push(storeInfo);
                }

                const actionName =
                  msg.type === 'ACTION'
                    ? msg.action
                    : msg.action || 'setState';

                const timestamp = msg.timestamp || Date.now();

                const actionRecord: ActionRecord = {
                  id: String(storeInfo.actions.length + 1),
                  action: actionName,
                  state: msg.state,
                  timestamp,
                  store: msg.store,
                  sessionId,
                };

                storeInfo.actions.push(actionRecord);
                if (storeInfo.actions.length > maxActions) {
                  storeInfo.actions = storeInfo.actions.slice(-maxActions);
                }
                storeInfo.currentState = msg.state;

                globalActions.push(actionRecord);
                if (globalActions.length > maxActions * 10) {
                  globalActions = globalActions.slice(-(maxActions * 10));
                }

                emitter.emit('actionDispatched', msg.store, actionRecord, sessionId);
                emitter.emit('storeUpdated', storeInfo);
                emitter.emit('storesChanged', emitter.getStores());
                emitter.emit('sessionsChanged', emitter.getSessions());
              }
            } catch {
              // ignore invalid message payload
            }
          });

          ws.on('close', () => {
            clients.delete(ws);
            const sessionId = socketSessionMap.get(ws);
            if (sessionId) {
              socketSessionMap.delete(ws);
              const socketSet = sessionSocketsMap.get(sessionId);
              if (socketSet) {
                socketSet.delete(ws);
                if (socketSet.size === 0) {
                  const session = sessions.get(sessionId);
                  if (session) {
                    session.status = 'offline';
                    session.lastSeen = Date.now();
                    emitter.emit('sessionStatusChanged', session);
                    emitter.emit('sessionsChanged', emitter.getSessions());
                  }
                }
              }
            }

            emitter.emit('clientDisconnected', ws);
            emitter.emit('clientCountChanged', clients.size);
          });
        });

        httpServer.listen(port, () => {
          resolve();
        });
      } catch (err) {
        reject(err);
      }
    });
  };

  emitter.stop = () => {
    return new Promise<void>((resolve, reject) => {
      for (const client of clients) {
        client.terminate();
      }
      clients.clear();
      sessions.clear();
      socketSessionMap.clear();
      sessionSocketsMap.clear();
      globalActions = [];

      if (wss) {
        wss.close();
        wss = null;
      }

      for (const socket of httpSockets) {
        socket.destroy();
      }
      httpSockets.clear();

      if (httpServer) {
        if (typeof (httpServer as any).closeAllConnections === 'function') {
          (httpServer as any).closeAllConnections();
        }
        httpServer.close((err) => {
          httpServer = null;
          emitter.httpServer = undefined;
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  };

  return emitter;
}
