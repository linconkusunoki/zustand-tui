import type { TuiClientMessage, OutgoingTuiMessage } from './protocol.js';
import { extractActionName } from './action-extractor.js';

export interface ClientConnectorOptions {
  url?: string;
  sessionId?: string;
  WebSocketClass?: typeof WebSocket;
}

export interface ClientConnection {
  close(): void;
  isConnected(): boolean;
  getSessionId(): string;
  send(message: OutgoingTuiMessage): void;
}

let globalClient: ClientConnection | null = null;
let storeCounter = 0;

export function resetStoreCounter(): void {
  storeCounter = 0;
}

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

export function connectToTui(options: ClientConnectorOptions = {}): ClientConnection {
  const url = options.url ?? 'ws://localhost:8080';
  const sessionId = options.sessionId ?? generateSessionId();
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
    getSessionId: () => sessionId,
    send: (message: OutgoingTuiMessage) => {
      const fullMessage: TuiClientMessage = {
        ...message,
        sessionId: message.sessionId ?? sessionId,
      } as TuiClientMessage;

      const serialized = JSON.stringify(fullMessage);
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

export interface TuiOptions extends ClientConnectorOptions {
  name?: string;
  client?: ClientConnection;
}

/**
 * Zustand middleware that automatically broadcasts actions, caller names, and state snapshots.
 */
export function tui<T>(
  nameOrOptions?: string | TuiOptions,
  optionsOrClient?: TuiOptions
) {
  let storeName: string | undefined;
  let clientOptions: ClientConnectorOptions = {};
  let clientInstance: ClientConnection | undefined;

  if (typeof nameOrOptions === 'string') {
    storeName = nameOrOptions;
    if (optionsOrClient) {
      if (optionsOrClient.client) {
        clientInstance = optionsOrClient.client;
      }
      clientOptions = optionsOrClient;
    }
  } else if (nameOrOptions && typeof nameOrOptions === 'object') {
    storeName = nameOrOptions.name;
    clientInstance = nameOrOptions.client;
    clientOptions = nameOrOptions;
  }

  const client =
    clientInstance ??
    (clientOptions.url || clientOptions.WebSocketClass || clientOptions.sessionId
      ? connectToTui(clientOptions)
      : getDefaultClient());

  return (initializer: any) => (set: any, get: any, api: any) => {
    if (!storeName) {
      storeCounter += 1;
      storeName = `Store-${storeCounter}`;
    }

    const namedStoreName = storeName;

    // Intercept set to capture action names
    const setWithAction = (partial: any, replace?: boolean, explicitActionName?: string) => {
      const err = new Error();
      const actionName = extractActionName(err.stack, explicitActionName);
      set(partial, replace);
      const nextState = get ? get() : api.getState();

      client.send({
        type: 'ACTION',
        store: namedStoreName,
        action: actionName,
        state: nextState,
        timestamp: Date.now(),
      });
    };

    const state = initializer(setWithAction, get, api);

    // Initial state registration
    client.send({
      type: 'INIT_STORE',
      store: namedStoreName,
      state: get ? get() : api.getState ? api.getState() : state,
    });

    return state;
  };
}
