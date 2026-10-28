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

    server.emit('sessionsChanged', [
      {
        id: 'sess-1',
        status: 'active',
        lastSeen: Date.now(),
        stores: [
          {
            name: 'cart',
            sessionId: 'sess-1',
            currentState: { items: ['apple'], total: 2.5 },
            actions: [
              { id: '1', action: '@@INIT', state: { items: [], total: 0 }, timestamp: Date.now() },
              { id: '2', action: 'addItem', state: { items: ['apple'], total: 2.5 }, timestamp: Date.now() },
            ],
          },
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

  it('renders sessions with active/offline badges and preserves inspection of offline sessions', async () => {
    const server = createTuiServer({ port: 8995 });
    const { lastFrame } = render(<App port={8995} server={server} />);

    await new Promise((r) => setTimeout(r, 20));

    server.emit('sessionsChanged', [
      {
        id: 'tab-desktop',
        status: 'active',
        lastSeen: Date.now(),
        stores: [
          {
            name: 'search-store',
            sessionId: 'tab-desktop',
            currentState: { query: 'camper' },
            actions: [{ id: '1', action: '@@INIT', state: { query: 'camper' }, timestamp: Date.now() }],
          },
        ],
      },
      {
        id: 'tab-mobile',
        status: 'offline',
        lastSeen: Date.now() - 5000,
        stores: [
          {
            name: 'checkout-store',
            sessionId: 'tab-mobile',
            currentState: { step: 'payment' },
            actions: [{ id: '1', action: '@@INIT', state: { step: 'payment' }, timestamp: Date.now() }],
          },
        ],
      },
    ]);

    await new Promise((r) => setTimeout(r, 30));

    const frame = lastFrame();
    expect(frame).toContain('tab-desktop');
    expect(frame).toContain('search-store');
    expect(frame).toContain('tab-mobile');
    expect(frame).toContain('[Offline]');
    expect(frame).toContain('checkout-store');
  });

  it('allows navigating action timeline and inspects historical state snapshot', async () => {
    const server = createTuiServer({ port: 8994 });
    const { lastFrame, stdin } = render(<App port={8994} server={server} />);

    await new Promise((r) => setTimeout(r, 20));

    server.emit('sessionsChanged', [
      {
        id: 'main-session',
        status: 'active',
        lastSeen: Date.now(),
        stores: [
          {
            name: 'counter',
            sessionId: 'main-session',
            currentState: { count: 2 },
            actions: [
              { id: '1', action: '@@INIT', state: { count: 0 }, timestamp: Date.now() },
              { id: '2', action: 'increment', state: { count: 1 }, timestamp: Date.now() },
              { id: '3', action: 'increment', state: { count: 2 }, timestamp: Date.now() },
            ],
          },
        ],
      },
    ]);

    await new Promise((r) => setTimeout(r, 30));

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

  it('toggles between Snapshot and Diff view with "d" key', async () => {
    const server = createTuiServer({ port: 8996 });
    const { lastFrame, stdin } = render(<App port={8996} server={server} />);

    await new Promise((r) => setTimeout(r, 20));

    server.emit('sessionsChanged', [
      {
        id: 'sess-diff',
        status: 'active',
        lastSeen: Date.now(),
        stores: [
          {
            name: 'profile',
            sessionId: 'sess-diff',
            currentState: { name: 'Bob', age: 31 },
            actions: [
              { id: '1', action: '@@INIT', state: { name: 'Alice', age: 30 }, timestamp: Date.now() },
              { id: '2', action: 'updateProfile', state: { name: 'Bob', age: 31 }, timestamp: Date.now() },
            ],
          },
        ],
      },
    ]);

    await new Promise((r) => setTimeout(r, 30));

    // By default in Snapshot mode
    expect(lastFrame()).toContain('[Snapshot]');
    expect(lastFrame()).toContain('"name": "Bob"');

    // Press 'd' to toggle into Diff view
    stdin.write('d');
    await new Promise((r) => setTimeout(r, 30));

    const diffFrame = lastFrame();
    expect(diffFrame).toContain('[Diff]');
    // Should show visual diff lines for modified keys
    expect(diffFrame).toContain('name');
    expect(diffFrame).toContain('"Alice" => "Bob"');
    expect(diffFrame).toContain('30 => 31');

    // Press 'd' again to toggle back to Snapshot mode
    stdin.write('d');
    await new Promise((r) => setTimeout(r, 30));

    expect(lastFrame()).toContain('[Snapshot]');
    expect(lastFrame()).toContain('"name": "Bob"');
  });
});
