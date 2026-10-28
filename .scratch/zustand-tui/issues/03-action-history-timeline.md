# 03: Action History Timeline with Stack-Trace Caller Extraction

**What to build:**
Intercept store mutations to track history. The client snippet extracts action names dynamically from caller stack traces when anonymous `set()` calls occur. The TUI adds a middle "Actions" pane showing a scrollable timeline of dispatched actions; selecting any historical action displays that action's specific state snapshot.

**Blocked by:** 02: Live Store Registration & State Viewer

**Status:** completed

- [x] Client snippet wraps `set()` to capture each mutation along with an explicit action name or an inferred caller name extracted from `new Error().stack`.
- [x] TUI layout expands to 3 panes: Stores (left), Action Timeline (middle), State Viewer (right).
- [x] Dispatched actions appear chronologically in the middle timeline.
- [x] Navigating up and down the action timeline updates the State Viewer to show the historical state snapshot at that specific action.
