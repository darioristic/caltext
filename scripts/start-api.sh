#!/usr/bin/env bash
# pm2 entrypoint for the Hono/Nitro API (node-server build).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/apps/api"
set -a; . ./.env; set +a
export PORT=3011 HOST=127.0.0.1 NODE_ENV=production
exec node .output/server/index.mjs
