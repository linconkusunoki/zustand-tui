import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { App } from './App.js';
import { createTuiServer } from '../server.js';

describe('App', () => {
  it('renders listening port and zero connected clients', () => {
    const { lastFrame } = render(<App port={8080} clientCount={0} />);
    expect(lastFrame()).toContain('Listening on port 8080');
    expect(lastFrame()).toContain('Connected clients: 0');
  });

  it('updates when clientCount changes', () => {
    const { lastFrame, rerender } = render(<App port={8080} clientCount={1} />);
    expect(lastFrame()).toContain('Connected clients: 1');

    rerender(<App port={8080} clientCount={3} />);
    expect(lastFrame()).toContain('Connected clients: 3');
  });

  it('reacts to server clientCountChanged events', async () => {
    const server = createTuiServer({ port: 8990 });
    const { lastFrame } = render(<App port={8990} server={server} />);
    expect(lastFrame()).toContain('Connected clients: 0');

    await new Promise((r) => setTimeout(r, 20));

    server.emit('clientCountChanged', 4);

    await new Promise((r) => setTimeout(r, 20));

    expect(lastFrame()).toContain('Connected clients: 4');
  });

  it('renders 3-pane layout with stores, actions timeline, and state viewer', async () => {
    const server = createTuiServer({ port: 8992 });
    const { lastFrame } = render(<App port={8992} server={server} />);

    await new Promise((r) => setTimeout(r, 20));

    expect(lastFrame()).toContain('Stores');
    expect(lastFrame()).toContain('Actions');
    expect(lastFrame()).toContain('State');

    // Simulate store with actions
    server.emit('storesChanged', [
      {
        name: 'cart',
        currentState: { items: ['apple'], total: 2.5 },
        actions: [
          { id: '1', action: '@@INIT', state: { items: [], total: 0 }, timestamp: Date.now() },
          { id: '2', action: 'addItem', state: { items: ['apple'], total: 2.5 }, timestamp: Date.now() },
        ],
      },
    ]);

    await new Promise((r) => setTimeout(r, 30));

    const frame = lastFrame();
    expect(frame).toContain('cart');
    expect(frame).toContain('@@INIT');
    expect(frame).toContain('addItem');
    expect(frame).toContain('"items"');
    expect(frame).toContain('"apple"');
    expect(frame).toContain('"total": 2.5');
  });

  it('allows navigating action timeline and inspects historical state snapshot', async () => {
    const server = createTuiServer({ port: 8994 });
    const { lastFrame, stdin } = render(<App port={8994} server={server} />);

    await new Promise((r) => setTimeout(r, 20));

    server.emit('storesChanged', [
      {
        name: 'counter',
        currentState: { count: 2 },
        actions: [
          { id: '1', action: '@@INIT', state: { count: 0 }, timestamp: Date.now() },
          { id: '2', action: 'increment', state: { count: 1 }, timestamp: Date.now() },
          { id: '3', action: 'increment', state: { count: 2 }, timestamp: Date.now() },
        ],
      },
    ]);

    await new Promise((r) => setTimeout(r, 30));

    // Initially displays the latest action snapshot (count: 2)
    expect(lastFrame()).toContain('"count": 2');

    // Press Tab to focus the Actions pane
    stdin.write('\t');
    await new Promise((r) => setTimeout(r, 30));

    // Press Up arrow to move from action 3 to action 2 (count: 1)
    stdin.write('\u001B[A');
    await new Promise((r) => setTimeout(r, 30));

    expect(lastFrame()).toContain('"count": 1');

    // Press Up arrow again to move to action 1 (@@INIT, count: 0)
    stdin.write('\u001B[A');
    await new Promise((r) => setTimeout(r, 30));

    expect(lastFrame()).toContain('"count": 0');
  });
});
