#!/usr/bin/env bash
# Quick check: is anything listening on 3000? Run this before or after starting the server.
echo "Port 3000:"
lsof -i :3000 2>/dev/null || echo "  Nothing listening."
echo ""
echo "If the server is running, try:"
echo "  http://localhost:3000"
echo "  http://127.0.0.1:3000"
