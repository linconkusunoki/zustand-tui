# 01: Walking Skeleton: CLI & Client Ping

**What to build:**
A runnable Node.js CLI binary that launches an embedded WebSocket server and renders an Ink terminal screen displaying live connection status. Accompanied by a minimal TypeScript client snippet that connects to `localhost:8080` and increments an active connection counter in the terminal.

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] Running the CLI binary starts a local WebSocket server listening on port 8080.
- [x] The CLI renders an interactive terminal screen using Ink showing "Listening on port 8080" and "Connected clients: 0".
- [x] Executing a minimal client snippet connects to the WebSocket server and increments the connection counter on screen.
- [x] Disconnecting the client decrements the connection counter live.
