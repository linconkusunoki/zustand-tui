# Zustand TUI

A high-performance, interactive **Terminal User Interface (TUI)** to inspect and debug [Zustand](https://zustand.docs.pmnd.rs/) state in real-time, inspired by tools like `rainfrog` and Redux DevTools.

```text
╭─────────────────────────────────────────────────────────────────────────────────────────────╮
│ Zustand TUI                                   Listening on port 8080 | Connected clients: 1 │
│                                                                                             │
│ ┌──────────────────────┐┌───────────────────────────┐┌────────────────────────────────────┐ │
│ │ Stores (2)           ││ Actions (4)               ││ State (booking @ selectVehicle) [Diff]│ │
│ │                      ││                           ││                                    │ │
│ │ tab-desktop (active) ││   @@INIT      3:30:12 PM  ││ ~ step: "search" => "vehicle_sel.. │ │
│ │  > auth-store        ││   loginUser   3:30:14 PM  ││ + camperId: "vw-california-t6"     │ │
│ │ tab-mobile  (active) ││ > selectVehicl3:30:16 PM  ││ ~ total: 0 => 450                  │ │
│ │    booking-store     ││   addInsurance3:30:18 PM  ││                                    │ │
│ └──────────────────────┘└───────────────────────────┘└────────────────────────────────────┘ │
│                                                                                             │
│ [Tab/Shift+Tab] Focus | [↑/↓ or j/k] Navigate | [d] Diff/Snapshot | [q/Esc] Quit            │
╰─────────────────────────────────────────────────────────────────────────────────────────────╯
```

---

## Features

- 🖥️ **Full-Screen Terminal Experience**: Runs in your terminal's alternate buffer (like `htop` or `vim`) with automatic resizing and clean shell restoration upon exit.
- ⚡ **Zero-Dependency Integration**: No heavy browser extensions or bloated npm packages required in your web app. Just a lightweight, copy-pasteable TypeScript snippet.
- 🔄 **Real-Time 3-Pane Layout**:
  - **Stores (Left)**: Multi-session grouping (desktop tabs, mobile, SSR) with `[Offline]` state retention on disconnect.
  - **Action Timeline (Middle)**: Chronological action history with human-readable timestamps.
  - **State Inspector (Right)**: Formatted JSON snapshot with a toggleable visual **Diff View** (`+ added`, `- removed`, `~ modified`).
- 🔍 **Caller Name Extraction**: Automatically infers action names directly from caller stack traces (e.g. `addBear`, `fetchProfile`) for standard `set()` calls, while also supporting explicit names.
- 🛡️ **Sliding Window Memory Protection**: Bounded action history (defaults to 100 actions per store) prevents memory leaks during high-frequency dispatching.
- 🔁 **Resilient Reconnection**: Built-in exponential backoff automatically reconnects and re-synchronizes store states when the TUI restarts.

---

## Quickstart

### 1. Launch the TUI in your terminal

```bash
# Run directly with npx
npx zustand-tui

# Or with a custom port
npx zustand-tui --port 8080
```

---

### 2. Add the Drop-in Snippet to your project

Create a file named `zustand-tui.ts` in your frontend project (e.g., in `src/utils/zustand-tui.ts`):

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

---

### 3. Wrap your Zustand store

Simply wrap your store creator function with `tui('myStoreName')`:

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

Every action and state mutation will now stream live into your terminal!

---

## Keyboard Navigation

| Key | Action |
| --- | --- |
| `Tab` / `Shift+Tab` | Cycle focus between panes (`Stores` ➔ `Actions` ➔ `State`) |
| `↑` / `↓` or `k` / `j` | Navigate items in the focused pane / scroll state |
| `d` | Toggle right pane between `[Snapshot]` and `[Diff]` view |
| `q` or `Esc` | Quit TUI cleanly |

---

## Development & Testing

```bash
# Clone the repository
git clone https://github.com/lincon/zustand-tui.git
cd zustand-tui

# Install dependencies
npm install

# Run the TUI in dev mode
npm run dev

# Run the live multi-session demo script
npm run demo

# Run test suite
npm test

# Typecheck and build
npm run typecheck
npm run build
```

---

## License

MIT © Lincon Kusunoki
