# Zustand TUI & MCP

Terminal and MCP server infrastructure for inspecting, time-traveling, and debugging Zustand state across runtime sessions.

## Language

**Store**:
A single Zustand state container managing a specific slice of application state, identified by an explicit name or fallback sequence.
_Avoid_: Slice, reducer, state tree

**Session**:
A single runtime instance of an application (such as an individual browser tab or SSR worker) connected to the telemetry server.
_Avoid_: Client, connection, process

**Action**:
A recorded state mutation event triggered by a store mutation (`set()`), containing the caller name, payload, and timestamp.
_Avoid_: Mutation, dispatch, event

**Snapshot**:
The complete JSON representation of a store's state at a discrete point in time following an action.
_Avoid_: Dump, state copy

**State Diff**:
The computed structural delta between two store snapshots, identifying added, removed, and modified keys.
_Avoid_: Patch, changeset, delta

**Active Session**:
The most recently communicating session, prioritized at the top of the store list and used as the default target for queries.
_Avoid_: Current tab, primary client

**Session Archive**:
The historical collection of disconnected sessions preserved in memory, accessible via the session switcher and clearable on demand.
_Avoid_: Closed tabs, history log, trash

**Path Selector**:
A dot-delimited string specifying a nested property within a snapshot to scope inspection to a specific sub-tree.
_Avoid_: Key path, query, jsonpath

**Action Timeline**:
A chronological ledger of actions recorded for a store, containing sequence identifiers, names, timestamps, and optional snapshots.
_Avoid_: Action log, event stream, history list

**Global Event Timeline**:
The unified chronological sequence of state mutation actions across all registered stores within a session.
_Avoid_: Master log, audit trail

**Telemetry Server**:
The local HTTP and WebSocket process that ingests store mutations from web clients and exposes interactive and MCP query endpoints.
_Avoid_: Backend, broker, daemon
