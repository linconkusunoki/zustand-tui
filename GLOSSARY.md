# Zustand TUI Glossary

## Store
A single Zustand state container managing a specific slice of application state. A Store is identified by an explicit name provided to the middleware, or a fallback sequence (e.g. `Store-1`) if unnamed.

## Session
A single runtime instance of the application (e.g., a specific browser tab, or the Next.js SSR process) that connects to the TUI. A session can contain multiple Stores.

## Action
An event that mutates a Store's state. In standard Zustand, this is simply a call to `set()`.

## Snapshot
The complete JSON representation of a Store's state at a specific point in time, immediately following an Action.
