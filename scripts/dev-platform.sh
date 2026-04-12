#!/usr/bin/env bash
# One-shot local dev: free port, raise watcher limits (macOS), start Next, open http:// (not https).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ulimit -n 10240 2>/dev/null || ulimit -n 8192 2>/dev/null || true

PORT="${PORT:-3000}"
URL="http://127.0.0.1:${PORT}"

echo "Freeing dev ports (Next.js 16 allows only one dev server per project)..."
for p in 3000 3010 3001; do
  lsof -ti ":${p}" | xargs kill -9 2>/dev/null || true
done
sleep 0.5

export NEXT_TELEMETRY_DISABLED=1
NEXT_BIN="${ROOT}/node_modules/.bin/next"
if [[ -x "${NEXT_BIN}" ]]; then
  "${NEXT_BIN}" dev -p "${PORT}" --hostname 0.0.0.0 --webpack &
else
  npx next dev -p "${PORT}" --hostname 0.0.0.0 --webpack &
fi
NEXT_PID=$!
trap 'kill "${NEXT_PID}" 2>/dev/null || true' EXIT INT TERM

opened=0
for _ in $(seq 1 120); do
  if curl -s -o /dev/null --connect-timeout 1 --max-time 3 "${URL}/" 2>/dev/null; then
    opened=1
    echo "Server is up — opening ${URL}"
    if command -v open >/dev/null 2>&1; then
      open "${URL}"
    elif command -v xdg-open >/dev/null 2>&1; then
      xdg-open "${URL}"
    fi
    break
  fi
  sleep 0.25
done

if [[ "${opened}" -eq 0 ]]; then
  echo "Could not confirm ${URL} within ~30s. Check errors above; the dev server may still be starting."
fi

wait "${NEXT_PID}"
trap - EXIT INT TERM
