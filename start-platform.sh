#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "=== Killing any existing servers on 3000/3001 ==="
pkill -f "next dev" 2>/dev/null || true
pkill -f "next start" 2>/dev/null || true
lsof -ti :3000 | xargs kill -9 2>/dev/null || true
lsof -ti :3001 | xargs kill -9 2>/dev/null || true
sleep 2

echo "=== Clearing cache ==="
rm -rf .next node_modules/.cache
echo "Cache cleared."

echo "=== Starting dev server on http://localhost:3000 ==="
npm run dev &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

echo "Waiting for server to be ready (up to 90s)..."
for i in $(seq 1 90); do
  if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/health 2>/dev/null | grep -q 200; then
    echo "Server is up and connected."
    break
  fi
  sleep 1
done

echo "Opening http://localhost:3000 in your browser..."
open "http://localhost:3000" 2>/dev/null || xdg-open "http://localhost:3000" 2>/dev/null || echo "Open in browser: http://localhost:3000"

echo "Server is running. Press Ctrl+C to stop."
wait $SERVER_PID
