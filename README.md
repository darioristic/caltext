# Caltext

iMessage calorie-tracking assistant powered by AI. Users text a phone number,
the bot onboards them conversationally, then logs meals from **photos** (GPT-4.1
vision) or **text** — tracking calories, macros, water, weight, streaks, and
sending timezone-aware reminders and daily/weekly summaries.

---

## Table of contents

- [Stack](#stack)
- [How it works](#how-it-works)
- [Project structure](#project-structure)
- [Environment variables](#environment-variables)
- [Local development](#local-development)
- [Production: self-hosted server](#production-self-hosted-server)
  - [Architecture on the server](#architecture-on-the-server)
  - [First-time server setup](#first-time-server-setup)
  - [Deploying changes](#deploying-changes)
  - [Operations / runbook](#operations--runbook)
- [Sendblue webhook](#sendblue-webhook)
- [Costs](#costs)

---

## Stack

| Layer | Tech |
|---|---|
| Runtime | **Bun** + **Turborepo** monorepo |
| Web (landing) | **Next.js 16** (App Router, next-intl) |
| API | **Hono** on **Nitro** (built with the `node-server` preset) |
| iMessage gateway | **Sendblue** (inbound webhook + outbound send) |
| AI | **AI SDK v6** + OpenAI **GPT-4.1** (vision + agent) / **GPT-4.1-mini** (text) |
| Database | **Redis** (local, accessed via an `ioredis` adapter) |
| Workflows | Vercel Workflow SDK (durable reminder loop) |
| Hosting | Self-hosted on a CloudPanel VPS, **nginx** + **pm2** + Let's Encrypt |

> **Note:** the project was originally scaffolded for Vercel + Upstash Redis.
> It now runs self-hosted with a **local Redis** (see
> [`packages/db/src/client.ts`](packages/db/src/client.ts) — a thin `ioredis`
> adapter that mimics the Upstash API so the data layer is unchanged).

---

## How it works

```
iPhone (iMessage)
      │  text / photo
      ▼
Sendblue ──webhook──▶  POST /webhooks/sendblue   (api.caltext.darioristic.com)
                              │
                              ▼
                       parseInbound()         verify sb-signing-secret, dedup + per-phone lock
                              │
                              ▼
                       routeMessage()
                       ├─ no profile yet ─▶ handleOnboarding()  collect name, goal, stats → daily target
                       └─ onboarded      ─▶ handleMessage()     the AI agent + tools
                                                  │
                                                  ├─ identifyFood   (GPT-4.1 vision on the photo)
                                                  ├─ logMeal        (after user confirms)
                                                  ├─ logWater / logWeight / getHistory / ...
                                                  └─ setReminders   (durable workflow)
                              │
                              ▼
                       Sendblue send  ──▶  reply back in iMessage
```

Key behaviours:

- **Onboarding** ignores photos — it only collects profile data (name, goal,
  height, weight, age, activity) and computes a daily calorie target.
- **Photo logging is two-step**: the agent calls `identifyFood` and replies with
  the estimated items/macros, then waits for the user to confirm ("yes" / "loguj")
  before calling `logMeal` and writing to the daily log.
- **HEIC photos** (the iPhone default) are decoded with `heic-convert` because
  sharp's prebuilt binary can't decode HEVC; non-HEIC images go straight through
  sharp. See [`apps/api/src/image.ts`](apps/api/src/image.ts).
- **Language** is auto-detected from the first message text (and falls back to the
  sender's phone country). Supported locale names live in
  [`packages/shared/src/locale.ts`](packages/shared/src/locale.ts) (en, sv, sr, de,
  fr, es, … ~30 languages).

---

## Project structure

```
caltext/
├── apps/
│   ├── api/                      # Hono API (Nitro)
│   │   ├── src/
│   │   │   ├── index.ts          # Nitro entry: routes + /webhooks/sendblue
│   │   │   ├── handler.ts        # webhook handler wiring
│   │   │   ├── router.ts         # onboarding vs. assistant routing
│   │   │   ├── sendblue.ts       # inbound parse + secret verification
│   │   │   ├── redis-utils.ts    # dedup + per-phone lock
│   │   │   ├── image.ts          # HEIC→JPEG + resize for vision
│   │   │   └── handlers/
│   │   │       ├── onboarding.ts
│   │   │       └── message.ts    # the AI agent loop
│   │   ├── workflows/
│   │   │   ├── reminder-loop.ts  # durable daily/weekly loop
│   │   │   └── steps/reminder-steps.ts
│   │   └── nitro.config.ts       # preset overridable via NITRO_PRESET
│   └── web/                      # Next.js landing page (i18n: en, sv)
├── packages/
│   ├── ai/                       # agent prompts + tools (identifyFood, logMeal, …)
│   │   └── src/tools/
│   ├── db/                       # Redis data layer
│   │   └── src/client.ts         # ioredis adapter (local Redis)
│   └── shared/                   # env, crypto, locale, timezone, types
└── scripts/                      # deploy + pm2 entrypoints (server)
    ├── deploy.sh
    ├── start-api.sh
    └── start-web.sh
```

---

## Environment variables

Each app reads its own `.env` (git-ignored). The API validates these at startup
([`packages/shared/src/env.ts`](packages/shared/src/env.ts)) — it will refuse to
boot if any are missing.

### `apps/api/.env`

| Variable | What | Source |
|---|---|---|
| `SENDBLUE_API_KEY` | Sendblue API key | [sendblue dashboard](https://sendblue.com) → API Credentials |
| `SENDBLUE_API_SECRET` | Sendblue secret | same |
| `SENDBLUE_FROM_NUMBER` | the bot's number, E.164 (`+1...`) | Sendblue number |
| `SENDBLUE_WEBHOOK_SECRET` | matches Sendblue's **Global Secret** (sent as `sb-signing-secret`) | you choose it |
| `REDIS_URL` | `redis://127.0.0.1:6379/3` (local Redis, DB index 3) | local |
| `OPENAI_API_KEY` | `sk-...` | [platform.openai.com](https://platform.openai.com) |
| `ENCRYPTION_KEY` | 64 hex chars for PII encryption | `openssl rand -hex 32` |

### `apps/web/.env`

| Variable | What |
|---|---|
| `NEXT_PUBLIC_PHONE_NUMBER` | the bot's number shown on the landing page (`+1...`) |

> `USDA_API_KEY` appears in `.env.example` but is **not used** by the code.

---

## Local development

```bash
bun install                # install all workspaces
cp apps/api/.env.example apps/api/.env   # then fill it in (see table above)
cp apps/web/.env.example apps/web/.env

bun run dev                # turbo: runs api (nitro dev) + web (next dev) together
```

You need a Redis reachable at `REDIS_URL`. Locally either run one
(`docker run -p 6379:6379 redis`) and set `REDIS_URL=redis://127.0.0.1:6379/0`,
or point it at any Redis you have.

Useful root scripts:

```bash
bun run build       # turbo build all packages
bun run typecheck   # tsc --noEmit across the monorepo
bun run test        # bun test
bun run lint        # biome check
bun run lint:fix    # biome check --fix
```

---

## Production: self-hosted server

Caltext runs on the **darioristic.com server** (CloudPanel VPS,
`116.203.149.70`), **not** on Vercel.

- Web → **https://caltext.darioristic.com**
- API → **https://api.caltext.darioristic.com** (Sendblue webhook target)

### Architecture on the server

| Piece | Detail |
|---|---|
| Code | `/home/darioristic/caltext` — a git clone of this repo, tracking `origin/main` |
| Auth | read-only **deploy key** at `~/.ssh/caltext_deploy` (repo `core.sshCommand`) |
| Runtime | `bun` (`~/.bun/bin/bun`) for builds; system `node` v20 runs the API |
| Processes | **pm2** as user `darioristic`, persisted by `pm2-darioristic.service` |
| pm2: `caltext-web` | Next.js on `127.0.0.1:3010` (`scripts/start-web.sh`) |
| pm2: `caltext-api` | Nitro node-server on `127.0.0.1:3011` (`scripts/start-api.sh`) |
| Reverse proxy | **nginx** vhosts in `/etc/nginx/sites-enabled/{caltext,api.caltext}.darioristic.com.conf` |
| TLS | Let's Encrypt via certbot (auto-renew), HTTP→HTTPS redirect |
| Redis | shared system Redis on `127.0.0.1:6379`, **DB index 3** isolates caltext keys |
| DNS | Vercel DNS — explicit `A` records for `caltext` & `api.caltext` → `116.203.149.70` |

> The API is built with `NITRO_PRESET=node-server` (the committed config defaults
> to the `vercel` preset; the env var overrides it). `sharp` is kept external so
> its native binary isn't bundled.

### First-time server setup

Already done, documented here for reference / disaster recovery. As the
`darioristic` user:

```bash
# 1. bun
curl -fsSL https://bun.sh/install | bash

# 2. deploy key (add the .pub as a read-only deploy key on the GitHub repo)
ssh-keygen -t ed25519 -f ~/.ssh/caltext_deploy -N ""

# 3. clone
git clone git@github.com:darioristic/caltext.git /home/darioristic/caltext
cd /home/darioristic/caltext
git config core.sshCommand "ssh -i ~/.ssh/caltext_deploy -o IdentitiesOnly=yes"

# 4. env files (see Environment variables) — these live ONLY on the server
$EDITOR apps/api/.env
$EDITOR apps/web/.env

# 5. install + build
bun install
bun run turbo build --filter=@caltext/shared --filter=@caltext/ai --filter=@caltext/db --filter=@caltext/web
( cd apps/api && NITRO_PRESET=node-server bun run build )

# 6. start under pm2
pm2 start scripts/start-api.sh --name caltext-api --interpreter bash
pm2 start scripts/start-web.sh --name caltext-web --interpreter bash
pm2 save
pm2 startup        # once, to install the systemd unit (run the printed command as root)
```

nginx + TLS (as root): create reverse-proxy vhosts pointing to `127.0.0.1:3010`
(web) and `127.0.0.1:3011` (api), then:

```bash
certbot --nginx -d caltext.darioristic.com -d api.caltext.darioristic.com \
  --non-interactive --agree-tos -m you@example.com --redirect
```

### Deploying changes

The deploy key is **read-only**, so the flow is push-from-laptop, pull-on-server.

```bash
# on your machine
git add -A && git commit -m "…" && git push

# on the server (as darioristic)
cd /home/darioristic/caltext && ./scripts/deploy.sh
```

Or in one line from your machine:

```bash
ssh root@116.203.149.70 \
  'sudo -u darioristic bash -lc "cd /home/darioristic/caltext && ./scripts/deploy.sh"'
```

[`scripts/deploy.sh`](scripts/deploy.sh) does:
`git pull` → `bun install` → `turbo build` (libs + web) →
`NITRO_PRESET=node-server` build of the API → `pm2 restart caltext-api caltext-web`.

> Changing anything in `packages/shared` (e.g. `locale.ts`, `env.ts`) requires the
> libs to be rebuilt before the API — `deploy.sh` already does this. Editing the
> API's `.env` and running `pm2 restart caltext-api --update-env` is enough for
> config-only changes.

### Operations / runbook

```bash
# logs (as darioristic)
pm2 logs caltext-api
pm2 logs caltext-web
pm2 logs caltext-api --lines 200 --nostream    # snapshot
pm2 flush caltext-api                           # clear log buffer

# status / restart
pm2 list
pm2 restart caltext-api caltext-web

# inspect data (caltext lives on Redis DB 3)
redis-cli -n 3 keys '*'
redis-cli -n 3 dbsize

# nginx
nginx -t && systemctl reload nginx             # as root
```

---

## Sendblue webhook

In the Sendblue dashboard → **Webhooks**:

1. Set a **Global Secret** equal to `SENDBLUE_WEBHOOK_SECRET`. Sendblue sends it
   as the `sb-signing-secret` header; the API verifies it in
   [`apps/api/src/sendblue.ts`](apps/api/src/sendblue.ts).
2. Under **Inbound Messages**, add the endpoint:
   ```
   https://api.caltext.darioristic.com/webhooks/sendblue
   ```

Then text the bot's number to test end-to-end.

---

## Costs

Hosting is free (own server, local Redis, Let's Encrypt, DNS). Two external
services are pay-per-use:

- **OpenAI** — ~1–2¢ per food photo (GPT-4.1 vision), well under 1¢ per text
  message (GPT-4.1-mini). Track at [platform.openai.com](https://platform.openai.com).
- **Sendblue** — monthly plan + per-message; the main fixed cost.
