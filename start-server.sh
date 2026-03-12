#!/usr/bin/env bash
# Shut down any existing dev servers, then start the platform on port 3000.

cd "$(dirname "$0")"

echo "Stopping any existing servers on 3000/3001..."
pkill -f "next dev" 2>/dev/null
lsof -ti :3000 | xargs kill -9 2>/dev/null
lsof -ti :3001 | xargs kill -9 2>/dev/null
sleep 2

echo "Starting TruckMates platform..."
echo "Open in browser: http://localhost:3000 or http://127.0.0.1:3000"
echo ""
npm run dev
