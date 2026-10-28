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

    // Wait for App to mount and attach listener
    await new Promise((r) => setTimeout(r, 20));

    server.emit('clientCountChanged', 4);

    // Wait for frame update
    await new Promise((r) => setTimeout(r, 20));

    expect(lastFrame()).toContain('Connected clients: 4');
  });

  it('renders 2-pane layout with stores and formatted state JSON', async () => {
    const server = createTuiServer({ port: 8992 });
    const { lastFrame } = render(<App port={8992} server={server} />);

    // Wait for mount
    await new Promise((r) => setTimeout(r, 20));

    expect(lastFrame()).toContain('Stores');
    expect(lastFrame()).toContain('State');
    expect(lastFrame()).toContain('No stores registered');

    // Simulate store updates from server
    server.emit('storesChanged', [
      { name: 'cart', currentState: { items: ['apple'], total: 2.5 } },
      { name: 'auth', currentState: { loggedIn: true } },
    ]);

    await new Promise((r) => setTimeout(r, 30));

    const frame = lastFrame();
    expect(frame).toContain('cart');
    expect(frame).toContain('auth');
    // Default selects first store 'cart' and displays formatted state
    expect(frame).toContain('"items"');
    expect(frame).toContain('"apple"');
    expect(frame).toContain('"total": 2.5');
  });

  it('supports keyboard navigation between stores', async () => {
    const server = createTuiServer({ port: 8993 });
    const { lastFrame, stdin } = render(<App port={8993} server={server} />);

    await new Promise((r) => setTimeout(r, 20));

    server.emit('storesChanged', [
      { name: 'storeA', currentState: { a: 1 } },
      { name: 'storeB', currentState: { b: 2 } },
    ]);

    await new Promise((r) => setTimeout(r, 30));

    expect(lastFrame()).toContain('> storeA');
    expect(lastFrame()).toContain('"a": 1');

    // Press down arrow
    stdin.write('\u001B[B');
    await new Promise((r) => setTimeout(r, 30));

    expect(lastFrame()).toContain('> storeB');
    expect(lastFrame()).toContain('"b": 2');
  });
});
