# Contributing to Zustand TUI

Thank you for your interest in contributing to **Zustand TUI**! We welcome community contributions, bug fixes, documentation improvements, and feature suggestions.

Please take a moment to review this document to make the contribution process smooth and effective for everyone.

---

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please treat all contributors and users with respect and kindness.

---

## Development Setup

### Prerequisites

- **Node.js**: v18.0.0 or higher (Node 20+ or 22+ recommended)
- **npm**: v9.0.0 or higher
- **Git**

### Installation

1. **Fork and clone** the repository:
   ```bash
   git clone https://github.com/lincon/zustand-tui.git
   cd zustand-tui
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the TUI in development mode**:
   ```bash
   npm run dev
   ```

4. **In a second terminal, run the mock dispatcher**:
   ```bash
   npm run demo
   ```
   This will simulate multi-session store registrations and dispatches against your running TUI.

---

## Project Architecture & Structure

```text
zustand-tui/
├── src/
│   ├── action-extractor.ts     # Parses caller names from Error().stack
│   ├── client.ts               # Zero-dependency client snippet & WebSocket client
│   ├── diff.ts                 # Recursive property-level JSON state diffing engine
│   ├── protocol.ts             # WebSocket message schemas (INIT_STORE, ACTION, SET_STATE)
│   ├── server.ts               # Embedded WebSocket relay server & session/store registry
│   ├── cli.tsx                 # Executable CLI entrypoint (fullscreen & signal handling)
│   ├── index.ts                # Package exports
│   └── ui/
│       ├── App.tsx             # Main 3-pane layout & keyboard focus manager
│       ├── StoreList.tsx       # Left Pane: Multi-session store tree & status badges
│       ├── ActionList.tsx      # Middle Pane: Chronological action history timeline
│       ├── StateViewer.tsx     # Right Pane: Formatted state snapshot & diff viewer
│       └── json-highlighter.tsx # Syntax highlighter for JSON keys, values, and punctuation
├── demo-dispatch.mjs           # Interactive script demonstrating live dispatches
└── dist/                       # Compiled ESM output
```

---

## Testing & Quality Assurance

We use [Vitest](https://vitest.dev/) for unit, component, and end-to-end testing, alongside TypeScript in strict mode.

Before opening a pull request, ensure all tests and type checks pass:

```bash
# Run unit and integration tests
npm test

# Run tests in watch mode during development
npm run test:watch

# Run TypeScript typechecker (strict mode)
npm run typecheck

# Verify build compilation
npm run build
```

### Writing Tests

- Follow the **Red-Green-Refactor** TDD cycle whenever adding new features or fixing bugs.
- Tests verify behaviors through public interfaces (seams), not private implementation details.
- Add test cases to the appropriate test file (`server.test.ts`, `client.test.ts`, `App.test.tsx`, `diff.test.ts`, `action-extractor.test.ts`, or `e2e.test.ts`).

---

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` A new user-facing feature or enhancement.
- `fix:` A bug fix.
- `docs:` Documentation updates.
- `test:` Adding or updating tests.
- `refactor:` Code changes that neither fix a bug nor add a feature.
- `chore:` Tooling, dependency updates, or build script changes.

Example:
```bash
git commit -m "feat: add JSON search filter in State pane"
```

---

## Pull Request Process

1. Create a feature branch off `master`:
   ```bash
   git checkout -b feat/my-new-feature
   ```
2. Make your changes and add corresponding tests.
3. Verify that `npm test`, `npm run typecheck`, and `npm run build` all pass cleanly.
4. Commit your changes following conventional commit syntax.
5. Push to your fork and submit a Pull Request describing:
   - What problem your change solves.
   - Any architectural decisions or trade-offs made.
   - How you verified the change.

Thank you for helping make Zustand TUI better!
