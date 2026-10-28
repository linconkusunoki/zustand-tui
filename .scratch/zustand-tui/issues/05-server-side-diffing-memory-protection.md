# 05: Server-Side State Diffing & Sliding Window Memory Protection

**What to build:**
Provide deep inspection of state mutations and protect against unbounded memory growth. The TUI computes visual deltas/diffs between consecutive snapshots locally, allowing developers to toggle between Full Snapshot and Diff views. The TUI enforces a 100-action sliding window limit per store to safeguard against out-of-memory crashes during high-frequency dispatching.

**Blocked by:** 04: Multi-Session Grouping & Offline State Retention

**Status:** completed

- [x] TUI calculates property-level additions, removals, and modifications between consecutive state snapshots.
- [x] Pressing a hotkey toggles the right pane between the full state snapshot and the visual diff highlighting changed keys.
- [x] The TUI sliding window discards the oldest actions beyond the 100-action limit per store to preserve memory.
- [x] High-frequency state updates (e.g. rapid dispatches) do not cause UI lag or out-of-memory crashes.
