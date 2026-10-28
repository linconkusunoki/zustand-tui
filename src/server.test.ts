import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { createTuiServer, TuiServer } from './server.js';

describe('TuiServer', () => {
  let server: TuiServer | null = null;
  const TEST_PORT = 8999;

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
  });

  it('starts on the configured port and tracks connected client counts', async () => {
    server = createTuiServer({ port: TEST_PORT });
    await server.start();

    expect(server.getClientCount()).toBe(0);

    const client1 = new WebSocket(`ws://localhost:${TEST_PORT}`);
    await new Promise<void>((resolve) => client1.on('open', () => resolve()));

    expect(server.getClientCount()).toBe(1);

    const client2 = new WebSocket(`ws://localhost:${TEST_PORT}`);
    await new Promise<void>((resolve) => client2.on('open', () => resolve()));

    expect(server.getClientCount()).toBe(2);

    client1.close();
    await new Promise<void>((resolve) => client1.on('close', () => resolve()));

    expect(server.getClientCount()).toBe(1);

    client2.close();
    await new Promise<void>((resolve) => client2.on('close', () => resolve()));

    expect(server.getClientCount()).toBe(0);
  });
});
