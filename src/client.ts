export interface ClientConnectorOptions {
  url?: string;
  WebSocketClass?: typeof WebSocket;
}

export interface ClientConnection {
  close(): void;
  isConnected(): boolean;
}

export function connectToTui(options: ClientConnectorOptions = {}): ClientConnection {
  const url = options.url ?? 'ws://localhost:8080';
  const WSClass = options.WebSocketClass ?? (typeof WebSocket !== 'undefined' ? WebSocket : undefined);

  if (!WSClass) {
    throw new Error('WebSocket implementation not found in global scope and none provided');
  }

  let connected = false;
  const ws = new WSClass(url);

  ws.addEventListener('open', () => {
    connected = true;
  });

  ws.addEventListener('close', () => {
    connected = false;
  });

  ws.addEventListener('error', () => {
    connected = false;
  });

  return {
    isConnected: () => connected,
    close: () => {
      connected = false;
      try {
        ws.close();
      } catch {
        // ignore already closed
      }
    },
  };
}
