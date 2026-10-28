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
});
