#!/bin/sh
set -e

echo "[start] Running database migrations..."
(cd packages/db && tsx src/migrate.ts) || echo "[start] Migrations skipped (may already be up to date)."

echo "[start] Starting Relay services..."

tsx apps/worker/src/index.ts &
WORKER_PID=$!

trap 'echo "[shutdown] Stopping worker..."; kill -TERM $WORKER_PID 2>/dev/null; wait $WORKER_PID 2>/dev/null; exit 0' TERM INT

tsx apps/api/src/index.ts
API_EXIT=$?

echo "[start] API exited ($API_EXIT), stopping worker..."
kill -TERM $WORKER_PID 2>/dev/null
wait $WORKER_PID 2>/dev/null
exit $API_EXIT
