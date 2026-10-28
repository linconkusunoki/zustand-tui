# 06: Full Keyboard Navigation, Resilient Reconnection & CLI Packaging

**What to build:**
Deliver a polished, production-ready developer experience. The TUI supports full keyboard navigation across all three panes, list scrolling, and quitting. The client snippet implements exponential backoff auto-reconnection so frontend tabs reconnect seamlessly when the TUI restarts. Package the project as a standalone executable CLI (`npx zustand-tui`) with a README containing the integration snippet.

**Blocked by:** 05: Server-Side State Diffing & Sliding Window Memory Protection

**Status:** completed

- [x] Keyboard navigation operates smoothly across all panes (`Tab` to cycle focus, arrows / `j`/`k` to navigate lists, `d` to toggle diff, `q` or `Esc` to quit).
- [x] If the TUI restarts, the client snippet automatically retries the WebSocket connection with exponential backoff until re-established.
- [x] Project can be run directly via `npx` or as a globally installed CLI binary.
- [x] README provides a clear, copy-pasteable TypeScript middleware snippet and setup instructions.
