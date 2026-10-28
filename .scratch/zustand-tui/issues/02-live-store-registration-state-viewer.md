# 02: Live Store Registration & State Viewer

**What to build:**
Extend the client snippet to transmit initial state and ongoing mutations for a named Zustand store. The TUI expands to a 2-pane layout (Store List on the left, State Viewer on the right), rendering the store's current state as syntax-highlighted JSON that updates in real-time as state mutations occur in the application.

**Blocked by:** 01: Walking Skeleton: CLI & Client Ping

**Status:** completed

- [x] Client snippet accepts a store name (or falls back to `Store-N`) and broadcasts initial state upon registration.
- [x] TUI left pane displays the list of registered stores with selection highlighting.
- [x] TUI right pane displays formatted JSON of the currently selected store's state.
- [x] State changes triggered in the application update the displayed JSON in real-time without flickering.
