<div align="center">

# 🐻 Zustand TUI

**A high-performance, interactive Terminal User Interface (TUI) to inspect, time-travel, and debug Zustand state in real-time.**

[![CI](https://github.com/linconkusunoki/zustand-tui/actions/workflows/ci.yml/badge.svg)](https://github.com/linconkusunoki/zustand-tui/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/zustand-tui.svg?color=green)](https://www.npmjs.com/package/zustand-tui)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Zustand](https://img.shields.io/badge/Zustand-v4%20%7C%20v5-orange)](https://zustand.docs.pmnd.rs/)

[Features](#-features) •
[Installation](#-installation) •
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
│ Zustand TUI        Listening on port 8080 (WS & MCP) | Connected clients: 1 (2 archived)    │
│                                                                                             │
│ ┌──────────────────────┐┌───────────────────────────┐┌────────────────────────────────────┐ │
│ │ Stores (2)           ││ All Events (4)            ││ State (cart @ applyCoupon) [Diff]  │ │
│ │                      ││                           ││                                    │ │
│ │  > ★ [All Stores] (4)││   [auth] @@INIT 3:30:12 PM││ + coupon: "SUMMER20"               │ │
│ │                      ││   [cart] addItem3:30:14 PM││ + discount: 24                     │ │
│ │ tab-desktop (active) ││ > [cart] applyCo3:30:16 PM││ ~ total: 120 => 96                 │ │
│ │    auth-store        ││   [auth] login  3:30:18 PM││                                    │ │
│ │    cart-store        ││                           ││                                    │ │
│ │                      ││                           ││                                    │ │
│ │ 📁 2 archived | [s]  ││                           ││                                    │ │
│ └──────────────────────┘└───────────────────────────┘└────────────────────────────────────┘ │
│                                                                                             │
│ [Tab] Focus | [↑/↓] Navigate | [d] Diff | [s] Sessions | [a] All Stores | [q] Quit          │
╰─────────────────────────────────────────────────────────────────────────────────────────────╯
```

</div>

---

## ⚡ Features

- 🖥️ **Full-Screen Terminal Experience**: Runs in your terminal's alternate buffer (like `htop`, `vim`, or `rainfrog`) with dynamic viewport sizing and clean shell restoration upon exit.
- 🌐 **Global Cross-Store Timeline (`★ [All Stores]`)**: Inspect all actions across every store in unified chronological sequence with `[storeName]` tags and store-aware state diffs. Press **`[a]`** to jump straight to it.
- ⚡ **Session History Manager & Active Filter (`[s]`)**: Automatically prioritizes active browser tabs at the top of your view upon page reload. Old tabs are neatly archived, inspectable in the session modal (**`[s]`**), and clearable on demand (**`[c]`**).
- 🤖 **Embedded Model Context Protocol (MCP) Server**: AI coding agents (Claude Desktop, Cursor, Gemini CLI) can directly query store states, inspect action history, and compute state diffs via tools and resources over SSE or stdio.
- 🎨 **JSON Syntax Highlighting**: Color-codes JSON keys (`cyan`), strings (`green`), numbers (`yellow`), booleans (`magenta`), null (`dimmed`), and structural braces (`gray`).
- ⚡ **Zero-Dependency Integration**: No heavy browser extensions or bloated npm packages required in your web app. Just a lightweight, copy-pasteable TypeScript snippet.
- 🔄 **Real-Time 3-Pane Layout**:
  - **Stores (Left)**: Multi-session grouping (desktop tabs, mobile, SSR) with active session priority and archive management.
  - **Action Timeline (Middle)**: Chronological action history with human-readable timestamps and store badges.
  - **State Inspector (Right)**: Formatted JSON snapshot with a toggleable visual **Diff View** (`+ added`, `- removed`, `~ modified`).
- 🔍 **Caller Name Extraction**: Automatically infers action names directly from caller stack traces (e.g. `addBear`, `fetchProfile`) for standard `set()` calls, while also supporting explicit names.
- 🛡️ **Sliding Window Memory Protection**: Bounded action history (defaults to 100 actions per store) prevents memory leaks during high-frequency dispatching.
- 🔁 **Resilient Reconnection**: Built-in exponential backoff automatically reconnects and re-synchronizes store states when the TUI restarts.

---

## 📦 Installation

Choose the installation method that fits your workflow:

### 1. Standalone Native Binary (Zero Dependencies — *lazygit* style)

Run `zustand-tui` and `zustand-mcp` anywhere as system commands without requiring Node.js or npm:

#### Quick Install (Linux & macOS):

```bash
# Linux (x64)
curl -fsSL https://github.com/linconkusunoki/zustand-tui/releases/latest/download/zustand-tui-linux-x64 -o ~/.local/bin/zustand-tui && chmod +x ~/.local/bin/zustand-tui
curl -fsSL https://github.com/linconkusunoki/zustand-tui/releases/latest/download/zustand-mcp-linux-x64 -o ~/.local/bin/zustand-mcp && chmod +x ~/.local/bin/zustand-mcp

# macOS (Apple Silicon M1/M2/M3/M4)
curl -fsSL https://github.com/linconkusunoki/zustand-tui/releases/latest/download/zustand-tui-darwin-arm64 -o /usr/local/bin/zustand-tui && chmod +x /usr/local/bin/zustand-tui
curl -fsSL https://github.com/linconkusunoki/zustand-tui/releases/latest/download/zustand-mcp-darwin-arm64 -o /usr/local/bin/zustand-mcp && chmod +x /usr/local/bin/zustand-mcp

# macOS (Intel)
curl -fsSL https://github.com/linconkusunoki/zustand-tui/releases/latest/download/zustand-tui-darwin-x64 -o /usr/local/bin/zustand-tui && chmod +x /usr/local/bin/zustand-tui
curl -fsSL https://github.com/linconkusunoki/zustand-tui/releases/latest/download/zustand-mcp-darwin-x64 -o /usr/local/bin/zustand-mcp && chmod +x /usr/local/bin/zustand-mcp
```

Pre-compiled binaries for **Linux (x64/arm64)**, **macOS (Apple Silicon/Intel)**, and **Windows** are also available directly on [GitHub Releases](https://github.com/linconkusunoki/zustand-tui/releases/latest).

#### Build from Source with Bun:

```bash
git clone https://github.com/linconkusunoki/zustand-tui.git
cd zustand-tui
bun install
bun run install:bin  # Compiles and installs directly to ~/.local/bin/
```

---

### 2. Global Installation via Package Manager

If you already have Node.js installed:

```bash
# npm
npm install -g zustand-tui

# pnpm
pnpm add -g zustand-tui

# bun
bun install -g zustand-tui
```

---

### 3. Local Project / Monorepo Linking

To link a local clone on your machine:

```bash
cd zustand-tui
npm install && npm run build
npm link

# Commands are now globally available:
zustand-tui
zustand-mcp
```

---

## 🚀 Quickstart: Single Command for Humans & AI Agents

Running `zustand-tui` (or `npx zustand-tui`) launches **both** the interactive Terminal UI and the embedded MCP Server simultaneously from a single command:

```bash
zustand-tui
# or without installing:
npx zustand-tui
```

When started, it runs on port `8080`:
- 🖥️ **Interactive Terminal UI**: Full 3-pane navigation, diffs, and snapshots for developer inspection.
- 🔄 **WebSocket Telemetry** (`ws://localhost:8080`): Receives real-time store mutations from client apps.
- 🤖 **MCP SSE Endpoint** (`http://localhost:8080/sse`): Direct connection for AI agents (Cursor, Claude Desktop, Gemini CLI).
- 🌐 **REST Snapshot API** (`http://localhost:8080/api/stores` & `/health`): Instant JSON inspection via `curl` or scripts.

Custom port:
```bash
zustand-tui --port 8080
```

---

## 🤖 Model Context Protocol (MCP) Configuration

AI coding agents can connect to your Zustand stores in two ways:

### Option 1: Direct SSE URL (Recommended with `npx zustand-tui`)

When you run `npx zustand-tui`, the MCP server is already live on `/sse`. In your agent configuration:

```json
{
  "mcpServers": {
    "zustand": {
      "url": "http://localhost:8080/sse"
    }
  }
}
```

### Option 2: stdio Binary (`npx zustand-mcp`)

If your agent runs local CLI commands over `stdio`:

```json
{
  "mcpServers": {
    "zustand": {
      "command": "npx",
      "args": ["zustand-mcp", "--port", "8080"]
    }
  }
}
```

> **Smart Bridging**: If `npx zustand-tui` is already running on port `8080`, `zustand-mcp` automatically detects it and bridges stdio traffic straight into the running TUI instance. If `zustand-tui` is not running, it starts in standalone headless mode.

### Available MCP Tools & Resources

| Tool | Description |
| --- | --- |
| `list_stores` | Lists connected sessions (active & offline) and registered stores. |
| `get_store_state` | Returns the state snapshot; supports dot-notation path selectors (e.g. `user.profile`, `items[0]`). |
| `get_action_history` | Chronological action timeline (metadata-first; opt-in state hydration via `includeState: true`). |
| `get_state_diff` | Computes machine-readable JSON diffs (`added`, `removed`, `updated`) between actions. |

**Resources:**
- `zustand://stores/{storeName}`: Live state snapshot for the active session.
- `zustand://sessions`: Connected sessions summary.

---

## 📦 Drop-in Client Snippet

Add this single zero-dependency file to your application (e.g., at `src/utils/zustand-tui.ts`):

```typescript
// zustand-tui.ts (Zero-dependency drop-in snippet)
export interface TuiOptions {
  url?: string;
  sessionId?: string;
}

type StoreLike = {
  getState: () => unknown;
  setState: (...args: unknown[]) => void;
  subscribe: (fn: (state: unknown, prev: unknown) => void) => () => void;
};

// Singleton telemetry client shared across all stores in the browser tab
class TuiSingletonClient {
  private ws: WebSocket | null = null;
  private queue: string[] = [];
  public sessionId: string;
  private url: string;
  private isConnecting = false;

  constructor(url = 'ws://localhost:8080') {
    this.url = url;
    this.sessionId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? `tab-${crypto.randomUUID().slice(0, 6)}`
        : `tab-${Math.random().toString(36).slice(2, 8)}`;
  }

  public send(msg: Record<string, unknown>) {
    const payload = JSON.stringify({ ...msg, sessionId: this.sessionId });
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
    } else {
      this.queue.push(payload);
      this.connect();
    }
  }

  public connect() {
    if (typeof WebSocket === 'undefined' || this.isConnecting) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isConnecting = true;
    try {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => {
        this.isConnecting = false;
        while (this.queue.length > 0) {
          const item = this.queue.shift();
          if (item) this.ws?.send(item);
        }
      };
      this.ws.onclose = () => {
        this.isConnecting = false;
        this.ws = null;
        setTimeout(() => this.connect(), 2000);
      };
      this.ws.onerror = () => {
        this.isConnecting = false;
        this.ws?.close();
      };
    } catch {
      this.isConnecting = false;
      setTimeout(() => this.connect(), 2000);
    }
  }
}

let globalClient: TuiSingletonClient | null = null;

function getGlobalClient(options: TuiOptions = {}): TuiSingletonClient | null {
  if (typeof window === 'undefined') return null;
  if (!globalClient) {
    globalClient = new TuiSingletonClient(options.url ?? 'ws://localhost:8080');
    if (options.sessionId) {
      globalClient.sessionId = options.sessionId;
    }
    globalClient.connect();
  }
  return globalClient;
}

export function tui<T>(
  storeOrName: T | string,
  nameOrOptions?: string | TuiOptions,
  maybeOptions?: TuiOptions
): T {
  // Bypassed in production, SSR, and Jest tests
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.NODE_ENV === 'test' ||
    typeof window === 'undefined'
  ) {
    if (typeof storeOrName === 'string') {
      return (((config: unknown) => config) as unknown) as T;
    }
    return storeOrName;
  }

  const options: TuiOptions = (typeof nameOrOptions === 'object' ? nameOrOptions : maybeOptions) || {};
  const client = getGlobalClient(options);

  // Pattern A: Post-creation wrapper (Non-intrusive, zero type friction)
  if (
    typeof storeOrName !== 'string' &&
    storeOrName &&
    typeof (storeOrName as unknown as StoreLike).getState === 'function'
  ) {
    const store = storeOrName as unknown as StoreLike;
    const storeName = typeof nameOrOptions === 'string' ? nameOrOptions : 'Store-1';

    if (client) {
      client.send({ type: 'INIT_STORE', store: storeName, state: store.getState() });

      const originalSetState = store.setState;
      store.setState = (...args: unknown[]) => {
        let action: unknown = args[2];
        if (typeof action === 'object' && action !== null && 'type' in action) {
          action = (action as { type: string }).type;
        }
        if (!action || typeof action !== 'string') {
          const stack = new Error().stack;
          const match = stack?.match(/at\s+(?:async\s+)?(?:[^\s(]+\.)?([a-zA-Z_$][a-zA-Z0-9_$]*)/g);
          action = match?.[1] ? match[1].replace(/^at\s+/, '') : 'setState';
        }

        originalSetState.apply(store, args);

        client.send({
          type: 'ACTION',
          store: storeName,
          action: String(action),
          state: store.getState(),
          timestamp: Date.now(),
        });
      };
    }

    return storeOrName;
  }

  // Pattern B: Curried middleware: create(tui('store-name')( (set, get) => ... ))
  const storeName = typeof storeOrName === 'string' ? storeOrName : 'Store-1';

  const middleware = (initializer: any) => (set: any, get: any, api: any) => {
    const setWithAction = (partial: any, replace?: boolean, actionParam?: any) => {
      let action: any = actionParam;
      if (typeof action === 'object' && action !== null && 'type' in action) {
        action = action.type;
      }
      if (!action || typeof action !== 'string') {
        const stack = new Error().stack;
        const match = stack?.match(/at\s+(?:async\s+)?(?:[^\s(]+\.)?([a-zA-Z_$][a-zA-Z0-9_$]*)/g);
        action = match?.[1] ? match[1].replace(/^at\s+/, '') : 'anonymous';
      }
      set(partial, replace, actionParam);
      client?.send({
        type: 'ACTION',
        store: storeName,
        action: String(action),
        state: get(),
        timestamp: Date.now(),
      });
    };

    const state = initializer(setWithAction, get, api);
    client?.send({ type: 'INIT_STORE', store: storeName, state: get ? get() : state });
    return state;
  };

  return (middleware as unknown) as T;
}
```

### Wrapping Your Zustand Stores

#### Pattern A: Post-Creation Wrapper (Recommended)

Non-intrusive. Wrap your existing store export without altering its type definitions or nested middleware (`persist`, `devtools`, `immer`):

```typescript
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { tui } from '@/utils/zustand-tui';

export const useCartStore = tui(
  create<CartState>()(
    devtools(
      persist(
        (set) => ({
          items: [],
          addItem: (item) => set((s) => ({ items: [...s.items, item] })),
        }),
        { name: 'cart-storage' }
      )
    )
  ),
  'cart-store'
);
```

#### Pattern B: Curried Middleware

Wrap the store initializer directly:

```typescript
import { create } from 'zustand';
import { tui } from '@/utils/zustand-tui';

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
| `a` | Jump directly to `★ [All Stores]` global event sequence |
| `s` | Open Sessions History Manager (view active & archived sessions) |
| `c` | Clear/purge all archived sessions (inside Sessions Manager) |
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
