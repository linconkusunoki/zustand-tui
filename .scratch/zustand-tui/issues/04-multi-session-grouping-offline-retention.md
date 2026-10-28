# 04: Multi-Session Grouping & Offline State Retention

**What to build:**
Enable multi-tab and SSR support without state collisions by isolating connections into Sessions. The client snippet generates a unique Session ID on initialization. The TUI organizes stores hierarchically under their respective Session in the left pane. When a browser tab or process disconnects, its session is marked with an `[Offline]` badge rather than deleted, preserving inspection history.

**Blocked by:** 03: Action History Timeline with Stack-Trace Caller Extraction

**Status:** completed

- [x] Client snippet generates a unique Session ID on boot and includes it in all WebSocket messages.
- [x] Stores from different browser tabs or SSR environments are grouped under their corresponding Session in the TUI left pane.
- [x] Closing a tab or disconnecting a client marks that Session as `[Offline]` in the UI without losing its action and state history.
- [x] Reconnecting or opening a new tab creates/updates the session cleanly without corrupting other active sessions.
