<div align="center">

# 🐻 Zustand TUI

**A high-performance, interactive Terminal User Interface (TUI) to inspect, time-travel, and debug Zustand state in real-time.**

[![CI](https://github.com/linconkusunoki/zustand-tui/actions/workflows/ci.yml/badge.svg)](https://github.com/linconkusunoki/zustand-tui/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/zustand-tui.svg?color=green)](https://www.npmjs.com/package/zustand-tui)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Zustand](https://img.shields.io/badge/Zustand-v4%20%7C%20v5-orange)](https://zustand.docs.pmnd.rs/)

[Features](#-features) •
[Quickstart](#-quickstart) •
[Drop-in Snippet](#-drop-in-client-snippet) •
[Keyboard Navigation](#-keyboard-navigation) •
[Architecture](#-architecture) •
[Contributing](#-contributing)

<br/>
<br/>

<img src="demo.gif" alt="Zustand TUI Live Demo" width="850" />

<br/>

```text
╭─────────────────────────────────────────────────────────────────────────────────────────────╮
│ Zustand TUI                                   Listening on port 8080 | Connected clients: 1 │
│                                                                                             │
│ ┌──────────────────────┐┌───────────────────────────┐┌────────────────────────────────────┐ │
│ │ Stores (2)           ││ Actions (4)               ││ State (cart @ applyCoupon) [Diff]  │ │
│ │                      ││                           ││                                    │ │
│ │ tab-desktop (active) ││   @@INIT      3:30:12 PM  ││ + coupon: "SUMMER20"               │ │
│ │   auth-store         ││   addItem     3:30:14 PM  ││ + discount: 24                     │ │
│ │ tab-mobile  (active) ││ > applyCoupon 3:30:16 PM  ││ ~ total: 120 => 96                 │ │
│ │  > cart-store        ││   checkoutOrde3:30:18 PM  ││                                    │ │
│ └──────────────────────┘└───────────────────────────┘└────────────────────────────────────┘ │
│                                                                                             │
│ [Tab/Shift+Tab] Focus | [↑/↓ or j/k] Navigate | [d] Diff/Snapshot | [q/Esc] Quit            │
╰─────────────────────────────────────────────────────────────────────────────────────────────╯
```

</div>

---

## ⚡ Features

- 🖥️ **Full-Screen Terminal Experience**: Runs in your terminal's alternate buffer (like `htop`, `vim`, or `rainfrog`) with dynamic viewport sizing and clean shell restoration upon exit.
- 🎨 **JSON Syntax Highlighting**: Color-codes JSON keys (`cyan`), strings (`green`), numbers (`yellow`), booleans (`magenta`), null (`dimmed`), and structural braces (`gray`).
- ⚡ **Zero-Dependency Integration**: No heavy browser extensions or bloated npm packages required in your web app. Just a lightweight, copy-pasteable TypeScript snippet.
- 🔄 **Real-Time 3-Pane Layout**:
  - **Stores (Left)**: Multi-session grouping (desktop tabs, mobile, SSR) with `[Offline]` state retention on disconnect.
  - **Action Timeline (Middle)**: Chronological action history with human-readable timestamps.
  - **State Inspector (Right)**: Formatted JSON snapshot with a toggleable visual **Diff View** (`+ added`, `- removed`, `~ modified`).
- 🔍 **Caller Name Extraction**: Automatically infers action names directly from caller stack traces (e.g. `addBear`, `fetchProfile`) for standard `set()` calls, while also supporting explicit names.
- 🛡️ **Sliding Window Memory Protection**: Bounded action history (defaults to 100 actions per store) prevents memory leaks during high-frequency dispatching.
- 🔁 **Resilient Reconnection**: Built-in exponential backoff automatically reconnects and re-synchronizes store states when the TUI restarts.

---

## 🚀 Quickstart

### 1. Launch the TUI in your terminal

No installation required—run directly using `npx`:

```bash
npx zustand-tui
```

Custom port:
```bash
npx zustand-tui --port 8080
```

---

## 📦 Drop-in Client Snippet

Add this single zero-dependency file to your application (e.g., at `src/utils/zustand-tui.ts`):

```typescript
// zustand-tui.ts (Zero-dependency drop-in snippet)
export interface TuiOptions {
  url?: string;
  sessionId?: string;
}

export function tui<T>(storeName?: string, options: TuiOptions = {}) {
  if (process.env.NODE_ENV === 'production') {
    return (config: any) => config;
  }

  const url = options.url ?? 'ws://localhost:8080';
  const sessionId =
    options.sessionId ??
    (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 9));

  let ws: WebSocket | null = null;
  const queue: string[] = [];

  function send(msg: any) {
    const payload = JSON.stringify({ ...msg, sessionId });
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    } else {
      queue.push(payload);
    }
  }

  function connect() {
    if (typeof WebSocket === 'undefined') return;
    try {
      ws = new WebSocket(url);
      ws.onopen = () => {
        while (queue.length > 0) ws?.send(queue.shift()!);
      };
      ws.onclose = () => setTimeout(connect, 2000);
      ws.onerror = () => ws?.close();
    } catch {
      setTimeout(connect, 2000);
    }
  }

  connect();

  return (initializer: any) => (set: any, get: any, api: any) => {
    const name = storeName || 'Store-1';

    const setWithAction = (partial: any, replace?: boolean, actionName?: string) => {
      let action = actionName;
      if (!action) {
        const stack = new Error().stack;
        const match = stack?.match(/at\s+(?:async\s+)?(?:[^\s(]+\.)?([a-zA-Z_$][a-zA-Z0-9_$]*)/g);
        action = match?.[1] ? match[1].replace(/^at\s+/, '') : 'anonymous';
      }
      set(partial, replace);
      send({ type: 'ACTION', store: name, action, state: get(), timestamp: Date.now() });
    };

    const state = initializer(setWithAction, get, api);
    send({ type: 'INIT_STORE', store: name, state: get ? get() : state });
    return state;
  };
}
```

### Wrap your Zustand store

```typescript
import { create } from 'zustand';
import { tui } from './zustand-tui';

export const useBearStore = create(
  tui('bearStore')((set) => ({
    bears: 0,
    increasePopulation: () => set((state: any) => ({ bears: state.bears + 1 })),
    removeAllBears: () => set({ bears: 0 }),
  }))
);
```

As actions are dispatched in your app, they immediately stream into the TUI in real-time!

---

## ⌨️ Keyboard Navigation

| Key | Action |
| --- | --- |
| `Tab` | Cycle focus forward (`Stores` ➔ `Actions` ➔ `State`) |
| `Shift + Tab` | Cycle focus backward (`State` ➔ `Actions` ➔ `Stores`) |
| `↑` / `↓` or `k` / `j` | Navigate items in the active pane / scroll JSON state |
| `d` | Toggle right pane between `[Snapshot]` and `[Diff]` view |
| `q` or `Esc` | Quit TUI cleanly and restore terminal |

---

## 📐 Architecture

```text
┌─────────────────────────┐          WebSocket           ┌───────────────────────────┐
│     Web Application     │  ─────────────────────────>  │        Zustand TUI        │
│                         │                              │                           │
│  - Zustand Stores       │  - INIT_STORE (snapshot)     │  - Embedded WS Server     │
│  - tui() Middleware     │  - ACTION (name, diff state) │  - Session / Store Tree   │
│  - Caller Stack Trace   │  - JSON Payloads             │  - Action History Window  │
│  - Auto-reconnection    │                              │  - Full-screen Ink Engine │
└─────────────────────────┘                              └───────────────────────────┘
```

1. **Embedded WebSocket Server**: Runs locally on `localhost:8080`.
2. **Session Isolation**: Each tab/process gets a unique Session ID to isolate stores.
3. **Diff Engine**: Diffs are computed server-side in Node.js, keeping the client runtime featherlight.
4. **Memory Guard**: Sliding-window buffer limits in-memory action retention per store.

---

## 🛠️ Development & Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for local development setup, coding standards, and pull request guidelines.

```bash
# Clone the repository
git clone https://github.com/linconkusunoki/zustand-tui.git
cd zustand-tui

# Install dependencies
npm install

# Run the TUI in development mode
npm run dev

# Run the live simulation demo
npm run demo

# Run test suite
npm test

# Typecheck and build
npm run typecheck
npm run build
```

---

## 📄 License

This project is open-source software licensed under the [MIT License](LICENSE).

© 2026 Lincon Kusunoki
