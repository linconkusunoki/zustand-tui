#!/usr/bin/env bash
set -e

# Run the background dispatcher after 1.5s once TUI is listening
(sleep 1.5 && node demo-dispatch.mjs >/dev/null 2>&1) &
DISPATCHER_PID=$!

cleanup() {
  kill $DISPATCHER_PID 2>/dev/null || true
}
trap cleanup EXIT

# Run TUI
node dist/cli.js --port 8080
