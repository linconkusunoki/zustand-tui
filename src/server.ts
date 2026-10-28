import { EventEmitter } from 'node:events';
import { WebSocketServer, WebSocket } from 'ws';
import type { TuiClientMessage } from './protocol.js';

export interface TuiServerOptions {
  port?: number;
}

export interface ActionRecord {
  id: string;
  action: string;
  state: unknown;
  timestamp: number;
}

export interface StoreInfo {
  name: string;
  currentState: unknown;
  actions: ActionRecord[];
}

export interface TuiServer extends EventEmitter {
  port: number;
  start(): Promise<void>;
  stop(): Promise<void>;
  getClientCount(): number;
  getStores(): StoreInfo[];
  getStoreActions(storeName: string): ActionRecord[];
}

export function createTuiServer(options: TuiServerOptions = {}): TuiServer {
  const port = options.port ?? 8080;
  const emitter = new EventEmitter() as TuiServer;
  let wss: WebSocketServer | null = null;
  const clients = new Set<WebSocket>();
  const stores = new Map<string, StoreInfo>();

  emitter.port = port;

  emitter.getClientCount = () => {
    return clients.size;
  };

  emitter.getStores = () => {
    return Array.from(stores.values());
  };

  emitter.getStoreActions = (storeName: string) => {
    return stores.get(storeName)?.actions ?? [];
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

              if (msg.type === 'INIT_STORE') {
                const initAction: ActionRecord = {
                  id: '1',
                  action: '@@INIT',
                  state: msg.state,
                  timestamp: Date.now(),
                };
                const storeInfo: StoreInfo = {
                  name: msg.store,
                  currentState: msg.state,
                  actions: [initAction],
                };
                stores.set(msg.store, storeInfo);
                emitter.emit('storeUpdated', storeInfo);
                emitter.emit('storesChanged', Array.from(stores.values()));
              } else if (msg.type === 'ACTION' || msg.type === 'SET_STATE') {
                let storeInfo = stores.get(msg.store);
                if (!storeInfo) {
                  storeInfo = {
                    name: msg.store,
                    currentState: msg.state,
                    actions: [],
                  };
                  stores.set(msg.store, storeInfo);
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
                storeInfo.currentState = msg.state;

                emitter.emit('actionDispatched', msg.store, actionRecord);
                emitter.emit('storeUpdated', storeInfo);
                emitter.emit('storesChanged', Array.from(stores.values()));
              }
            } catch {
              // ignore invalid message payload
            }
          });

          ws.on('close', () => {
            clients.delete(ws);
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
      stores.clear();

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
