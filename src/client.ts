import type { TuiClientMessage, OutgoingTuiMessage } from './protocol.js';
import { extractActionName } from './action-extractor.js';

export interface ClientConnectorOptions {
  url?: string;
  sessionId?: string;
  autoReconnect?: boolean;
  initialReconnectDelay?: number;
  maxReconnectDelay?: number;
  WebSocketClass?: typeof WebSocket;
}

export interface ClientConnection {
  close(): void;
  isConnected(): boolean;
  getSessionId(): string;
  send(message: OutgoingTuiMessage): void;
  registerSyncStore?(syncFn: () => void): () => void;
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
  const autoReconnect = options.autoReconnect ?? true;
  const initialDelay = options.initialReconnectDelay ?? 1000;
  const maxDelay = options.maxReconnectDelay ?? 10000;
  const WSClass = options.WebSocketClass ?? (typeof WebSocket !== 'undefined' ? WebSocket : undefined);

  if (!WSClass) {
    throw new Error('WebSocket implementation not found in global scope and none provided');
  }

  let connected = false;
  let isExplicitlyClosed = false;
  let retryCount = 0;
  let reconnectTimer: any = null;
  const messageQueue: string[] = [];
  const registeredSyncCallbacks = new Set<() => void>();
  let ws: any = null;

  function scheduleReconnect() {
    if (isExplicitlyClosed || reconnectTimer !== null) {
      return;
    }
    const delay = Math.min(initialDelay * Math.pow(1.5, retryCount), maxDelay);
    retryCount += 1;

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (!isExplicitlyClosed) {
        setupSocket();
      }
    }, delay);
  }

  function setupSocket() {
    try {
      ws = new WSClass!(url);

      ws.addEventListener('open', () => {
        connected = true;
        retryCount = 0;

        // Re-synchronize all registered stores
        registeredSyncCallbacks.forEach((sync) => {
          try {
            sync();
          } catch {
            // ignore sync errors
          }
        });

        // Flush any queued messages
        while (messageQueue.length > 0) {
          const msg = messageQueue.shift();
          if (msg) {
            ws.send(msg);
          }
        }
      });

      ws.addEventListener('close', () => {
        connected = false;
        if (!isExplicitlyClosed && autoReconnect) {
          scheduleReconnect();
        }
      });

      ws.addEventListener('error', () => {
        connected = false;
        if (!isExplicitlyClosed && autoReconnect) {
          scheduleReconnect();
        }
      });
    } catch {
      connected = false;
      if (!isExplicitlyClosed && autoReconnect) {
        scheduleReconnect();
      }
    }
  }

  setupSocket();

  const connection: ClientConnection = {
    isConnected: () => connected,
    getSessionId: () => sessionId,
    send: (message: OutgoingTuiMessage) => {
      const fullMessage: TuiClientMessage = {
        ...message,
        sessionId: message.sessionId ?? sessionId,
      } as TuiClientMessage;

      const serialized = JSON.stringify(fullMessage);
      if (connected && ws && ws.readyState === 1) {
        ws.send(serialized);
      } else {
        messageQueue.push(serialized);
      }
    },
    registerSyncStore: (syncFn: () => void) => {
      registeredSyncCallbacks.add(syncFn);
      return () => {
        registeredSyncCallbacks.delete(syncFn);
      };
    },
    close: () => {
      isExplicitlyClosed = true;
      connected = false;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      try {
        if (ws) {
          ws.close();
        }
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

  const broadcastInit = () => {
    client.send({
      type: 'INIT_STORE',
      store: storeName!,
      state: store.getState(),
    });
  };

  // Broadcast initial state
  broadcastInit();

  // Register re-sync on reconnect
  const unregisterSync = client.registerSyncStore?.(broadcastInit);

  // Subscribe to subsequent state mutations
  const unsubscribeState = store.subscribe((nextState: T) => {
    client.send({
      type: 'SET_STATE',
      store: storeName!,
      state: nextState,
    });
  });

  return () => {
    unregisterSync?.();
    unsubscribeState();
  };
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
    (clientOptions.url || clientOptions.WebSocketClass || clientOptions.sessionId || clientOptions.autoReconnect !== undefined
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

    const broadcastInit = () => {
      client.send({
        type: 'INIT_STORE',
        store: namedStoreName,
        state: get ? get() : api.getState ? api.getState() : state,
      });
    };

    // Initial state registration
    broadcastInit();

    // Register re-sync on reconnect
    client.registerSyncStore?.(broadcastInit);

    return state;
  };
}
