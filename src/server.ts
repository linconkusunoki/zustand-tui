import { EventEmitter } from 'node:events';
import { WebSocketServer, WebSocket } from 'ws';

export interface TuiServerOptions {
  port?: number;
}

export interface TuiServer extends EventEmitter {
  port: number;
  start(): Promise<void>;
  stop(): Promise<void>;
  getClientCount(): number;
}

export function createTuiServer(options: TuiServerOptions = {}): TuiServer {
  const port = options.port ?? 8080;
  const emitter = new EventEmitter() as TuiServer;
  let wss: WebSocketServer | null = null;
  const clients = new Set<WebSocket>();

  emitter.port = port;

  emitter.getClientCount = () => {
    return clients.size;
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
