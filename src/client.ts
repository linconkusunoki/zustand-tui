import type { TuiClientMessage } from './protocol.js';

export interface ClientConnectorOptions {
  url?: string;
  WebSocketClass?: typeof WebSocket;
}

export interface ClientConnection {
  close(): void;
  isConnected(): boolean;
  send(message: TuiClientMessage): void;
}

let globalClient: ClientConnection | null = null;
let storeCounter = 0;

export function resetStoreCounter(): void {
  storeCounter = 0;
}

export function connectToTui(options: ClientConnectorOptions = {}): ClientConnection {
  const url = options.url ?? 'ws://localhost:8080';
  const WSClass = options.WebSocketClass ?? (typeof WebSocket !== 'undefined' ? WebSocket : undefined);

  if (!WSClass) {
    throw new Error('WebSocket implementation not found in global scope and none provided');
  }

  let connected = false;
  const messageQueue: string[] = [];
  const ws = new WSClass(url);

  ws.addEventListener('open', () => {
    connected = true;
    while (messageQueue.length > 0) {
      const msg = messageQueue.shift();
      if (msg) {
        ws.send(msg);
      }
    }
  });

  ws.addEventListener('close', () => {
    connected = false;
  });

  ws.addEventListener('error', () => {
    connected = false;
  });

  const connection: ClientConnection = {
    isConnected: () => connected,
    send: (message: TuiClientMessage) => {
      const serialized = JSON.stringify(message);
      if (connected) {
        ws.send(serialized);
      } else {
        messageQueue.push(serialized);
      }
    },
    close: () => {
      connected = false;
      try {
        ws.close();
      } catch {
        // ignore already closed
      }
    },
  };

  return connection;
}

export function getDefaultClient(): ClientConnection {
  if (!globalClient) {
    globalClient = connectToTui();
  }
  return globalClient;
}

export interface StoreLike<T = unknown> {
  getState(): T;
  subscribe(listener: (state: T) => void): () => void;
}

export interface RegisterStoreOptions {
  name?: string;
  client?: ClientConnection;
}

export function registerStore<T>(
  store: StoreLike<T>,
  options: RegisterStoreOptions = {}
): () => void {
  const client = options.client ?? getDefaultClient();
  let storeName = options.name;

  if (!storeName) {
    storeCounter += 1;
    storeName = `Store-${storeCounter}`;
  }

  // Broadcast initial state
  client.send({
    type: 'INIT_STORE',
    store: storeName,
    state: store.getState(),
  });

  // Subscribe to subsequent state mutations
  const unsubscribe = store.subscribe((nextState: T) => {
    client.send({
      type: 'SET_STATE',
      store: storeName!,
      state: nextState,
    });
  });

  return unsubscribe;
}
