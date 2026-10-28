import { EventEmitter } from 'node:events';
import { WebSocketServer, WebSocket } from 'ws';
import type { TuiClientMessage } from './protocol.js';

export interface TuiServerOptions {
  port?: number;
  maxActionsPerStore?: number;
}

export interface ActionRecord {
  id: string;
  action: string;
  state: unknown;
  timestamp: number;
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
  start(): Promise<void>;
  stop(): Promise<void>;
  getClientCount(): number;
  getSessions(): SessionInfo[];
  getStores(sessionId?: string): StoreInfo[];
  getStoreActions(storeName: string, sessionId?: string): ActionRecord[];
}

export function createTuiServer(options: TuiServerOptions = {}): TuiServer {
  const port = options.port ?? 8080;
  const maxActions = options.maxActionsPerStore ?? 100;
  const emitter = new EventEmitter() as TuiServer;
  let wss: WebSocketServer | null = null;
  const clients = new Set<WebSocket>();

  const sessions = new Map<string, SessionInfo>();
  const socketSessionMap = new Map<WebSocket, string>();
  const sessionSocketsMap = new Map<string, Set<WebSocket>>();

  emitter.port = port;

  emitter.getClientCount = () => {
    return clients.size;
  };

  emitter.getSessions = () => {
    return Array.from(sessions.values());
  };

  emitter.getStores = (sessionId?: string) => {
    if (sessionId) {
      return sessions.get(sessionId)?.stores ?? [];
    }
    const allStores: StoreInfo[] = [];
    for (const session of sessions.values()) {
      allStores.push(...session.stores);
    }
    return allStores;
  };

  emitter.getStoreActions = (storeName: string, sessionId?: string) => {
    const stores = emitter.getStores(sessionId);
    const store = stores.find((s) => s.name === storeName);
    return store?.actions ?? [];
  };

  emitter.start = () => {
    return new Promise<void>((resolve, reject) => {
      try {
        wss = new WebSocketServer({ port }, () => {
          resolve();
        });

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

                emitter.emit('storeUpdated', storeInfo);
                emitter.emit('storesChanged', emitter.getStores());
                emitter.emit('sessionsChanged', Array.from(sessions.values()));
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
                };

                storeInfo.actions.push(actionRecord);
                if (storeInfo.actions.length > maxActions) {
                  storeInfo.actions = storeInfo.actions.slice(-maxActions);
                }
                storeInfo.currentState = msg.state;

                emitter.emit('actionDispatched', msg.store, actionRecord, sessionId);
                emitter.emit('storeUpdated', storeInfo);
                emitter.emit('storesChanged', emitter.getStores());
                emitter.emit('sessionsChanged', Array.from(sessions.values()));
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
                    emitter.emit('sessionsChanged', Array.from(sessions.values()));
                  }
                }
              }
            }

            emitter.emit('clientDisconnected', ws);
            emitter.emit('clientCountChanged', clients.size);
          });
        });
      } catch (err) {
        reject(err);
      }
    });
  };

  emitter.stop = () => {
    return new Promise<void>((resolve, reject) => {
      if (!wss) {
        return resolve();
      }

      for (const client of clients) {
        client.terminate();
      }
      clients.clear();
      sessions.clear();
      socketSessionMap.clear();
      sessionSocketsMap.clear();

      wss.close((err) => {
        wss = null;
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  };

  return emitter;
}
