#!/usr/bin/env bash
# pm2 entrypoint for the Next.js web app.
export PATH="$HOME/.bun/bin:$PATH"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/apps/web"
[ -f .env ] && { set -a; . ./.env; set +a; }
export NODE_ENV=production
exec bun run --bun next start -p 3010 -H 127.0.0.1
