#!/usr/bin/env bash
# Pull latest, rebuild, and restart both pm2 processes. Run as the `darioristic`
# user on the server: scripts/deploy.sh
set -euo pipefail
export PATH="$HOME/.bun/bin:$PATH"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "[deploy] git pull..."
git pull --ff-only

echo "[deploy] bun install..."
bun install

echo "[deploy] build libs + web..."
bun run turbo build \
  --filter=@caltext/shared --filter=@caltext/ai --filter=@caltext/db --filter=@caltext/web

echo "[deploy] build api (node-server preset)..."
( cd apps/api && NITRO_PRESET=node-server bun run build )

echo "[deploy] restart pm2..."
pm2 restart caltext-api caltext-web --update-env

echo "[deploy] done ✓"
